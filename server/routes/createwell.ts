import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { invalidatePublicCache, readPublicCache } from "../notion/cache";
import { notionConfig } from "../notion/config";
import { checkInInputSchema, taskCreateInputSchema, topicWellInputSchema } from "../notion/schemas";
import { createPayloadHash, IdempotencyStore, verifyNotionWebhookSignature } from "../notion/security";
import {
  createCheckIn,
  createTask,
  createTopicWellDrop,
  getActiveOffers,
  getApprovedContent,
  getUpcomingEvents,
  listCheckIns,
  listDataSourceRecords,
  listDecisions,
  listNeeds,
  listTasks,
  getTeamProfile,
  resolvePersonPageId,
} from "../notion/service";

const topicWellRateLimits = new Map<string, number[]>();
const topicWellIdempotency = new IdempotencyStore<Record<string, unknown>>();
const TOPIC_WELL_RATE_LIMIT = 8;
const TOPIC_WELL_WINDOW_MS = 15 * 60 * 1_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

function getClientIp(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
}

export function consumeTopicWellRateLimit(ip: string) {
  const now = Date.now();
  const windowStart = now - TOPIC_WELL_WINDOW_MS;
  const attempts = (topicWellRateLimits.get(ip) ?? []).filter(timestamp => timestamp > windowStart);
  if (attempts.length >= TOPIC_WELL_RATE_LIMIT) return false;
  attempts.push(now);
  topicWellRateLimits.set(ip, attempts);
  return true;
}

export function resetTopicWellSafeguardsForTests() {
  topicWellRateLimits.clear();
  topicWellIdempotency.clear();
}

async function requireAuthenticatedUser(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Authentication is required." });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "Authentication is required." });
    return null;
  }
}

async function requireAdminUser(req: Request, res: Response) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access is required." });
    return null;
  }
  return user;
}

function errorResponse(error: unknown, res: Response) {
  console.error("[Create Well] Server route failed", error);
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  res.status(500).json({ error: message });
}

export function registerCreateWellRoutes(app: Express) {
  app.set("trust proxy", 1);

  app.get("/api/public/content", async (_req, res) => {
    try {
      res.json({ items: await readPublicCache("content", getApprovedContent) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/public/offers", async (_req, res) => {
    try {
      res.json({ model: "Well-to-Geyser", items: await readPublicCache("offers", getActiveOffers) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/public/events", async (_req, res) => {
    try {
      res.json({ items: await readPublicCache("events", getUpcomingEvents) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.post("/api/topic-well", async (req, res) => {
    const ip = getClientIp(req);
    if (!consumeTopicWellRateLimit(ip)) {
      res.status(429).json({ error: "Too many topic drops. Please wait before submitting again." });
      return;
    }

    const parsed = topicWellInputSchema.safeParse({
      ...req.body,
      idempotencyKey: req.header("idempotency-key") ?? req.body?.idempotencyKey,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Topic Well submission is incomplete or invalid.", details: parsed.error.flatten() });
      return;
    }

    const key = parsed.data.idempotencyKey ?? crypto.randomUUID();
    const scopedKey = `${ip}:${key}`;
    const payloadHash = createPayloadHash(parsed.data);
    const replay = topicWellIdempotency.read(scopedKey, payloadHash);
    if (replay.kind === "conflict") {
      res.status(409).json({ error: "This idempotency key was already used for a different topic drop." });
      return;
    }
    if (replay.kind === "replay") {
      res.status(200).json({ ...replay.response, duplicate: true });
      return;
    }

    try {
      const page = await createTopicWellDrop(parsed.data);
      const response = { success: true, idempotencyKey: key, recordId: (page as { id?: string }).id ?? null };
      topicWellIdempotency.write(scopedKey, payloadHash, response, IDEMPOTENCY_TTL_MS);
      res.status(201).json(response);
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.post("/api/webhooks/notion", async (req, res) => {
    const verificationToken = req.body?.verification_token;
    if (verificationToken) {
      res.status(202).json({ received: true, message: "Verification token received. Configure it as NOTION_WEBHOOK_VERIFICATION_TOKEN before activating this subscription." });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !verifyNotionWebhookSignature(rawBody, req.header("x-notion-signature"), notionConfig.webhookVerificationToken)) {
      res.status(401).json({ error: "Invalid Notion webhook signature." });
      return;
    }

    const sourceId = req.body?.data_source_id ?? req.body?.entity?.data_source_id ?? req.body?.parent?.data_source_id;
    const publicSourceIds = new Set([notionConfig.dataSourceIds.content, notionConfig.dataSourceIds.events]);
    if (!sourceId || publicSourceIds.has(sourceId)) {
      invalidatePublicCache();
    }
    res.status(202).json({ received: true });
  });

  app.get("/api/team/tasks", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({ items: await listTasks() });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/profile", async (req, res) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    try {
      const profile = await getTeamProfile(user);
      const checkIns = await listCheckIns(profile.personPageId);
      res.json({
        ...profile,
        checkInCount: checkIns.length,
        lastCheckIn: checkIns[0] ? {
          week: checkIns[0].week,
          mood: checkIns[0].mood,
          absorption: checkIns[0].absorption,
          bodyStatus: checkIns[0].bodyStatus,
        } : null,
      });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.post("/api/team/tasks", async (req, res) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const parsed = taskCreateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Task payload is invalid.", details: parsed.error.flatten() });
      return;
    }
    try {
      const personPageId = await resolvePersonPageId(user);
      const page = await createTask(parsed.data, personPageId);
      res.status(201).json({ item: page });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/events", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({ items: await listDataSourceRecords(notionConfig.dataSourceIds.events) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/content", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({ items: await listDataSourceRecords(notionConfig.dataSourceIds.content) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/check-ins", async (req, res) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    try {
      const personPageId = await resolvePersonPageId(user);
      res.json({ items: await listCheckIns(personPageId) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.post("/api/team/check-ins", async (req, res) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const parsed = checkInInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Check-in payload is invalid.", details: parsed.error.flatten() });
      return;
    }
    try {
      const personPageId = await resolvePersonPageId(user);
      const page = await createCheckIn(parsed.data, personPageId, user.name);
      res.status(201).json({ item: page });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/admin/needs", async (req, res) => {
    if (!(await requireAdminUser(req, res))) return;
    try {
      res.json({ items: await listNeeds() });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/admin/decisions", async (req, res) => {
    if (!(await requireAdminUser(req, res))) return;
    try {
      res.json({ items: await listDecisions() });
    } catch (error) {
      errorResponse(error, res);
    }
  });
}

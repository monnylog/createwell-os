import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { invalidatePublicCache, readPublicCache } from "../notion/cache";
import { notionConfig } from "../notion/config";
import {
  IdempotencyStore,
  verifyNotionWebhookSignature,
} from "../notion/security";
import { assertMoneyNeverPublic } from "../notion/v3-guards";
import {
  getApprovedContent,
  getTeamProfile,
  getUpcomingPublicFlows,
  listDataSourceRecords,
  listFlows,
  listMoves,
} from "../notion/service";

/**
 * Create Well OS v3 HTTP routes.
 *
 * Public surface: two reads. `/api/public/content` and `/api/public/flows`.
 * No public write. No MONEY route. No PEOPLE route.
 *
 * Removed in v3: `/api/public/offers`, `/api/public/events`, `/api/topic-well`,
 * `POST /api/team/tasks`, `/api/team/check-ins`, `/api/admin/needs`, and
 * `/api/admin/decisions`. See docs/v3-domain-map.md.
 *
 * The Topic Well rate limiter and idempotency store are retained below: the
 * intake route is paused, not the safeguards, and reinstating intake should not
 * mean rebuilding them from scratch.
 */

const topicWellRateLimits = new Map<string, number[]>();
const topicWellIdempotency = new IdempotencyStore<Record<string, unknown>>();
const TOPIC_WELL_RATE_LIMIT = 8;
const TOPIC_WELL_WINDOW_MS = 15 * 60 * 1_000;

export function consumeTopicWellRateLimit(ip: string) {
  const now = Date.now();
  const windowStart = now - TOPIC_WELL_WINDOW_MS;
  const attempts = (topicWellRateLimits.get(ip) ?? []).filter(
    timestamp => timestamp > windowStart
  );
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

function errorResponse(error: unknown, res: Response) {
  console.error("[Create Well] Server route failed", error);
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";
  res.status(500).json({ error: message });
}

export function registerCreateWellRoutes(app: Express) {
  app.set("trust proxy", 1);

  // --- Public: two reads, nothing else -------------------------------------

  app.get("/api/public/content", async (_req, res) => {
    try {
      res.json({ items: await readPublicCache("content", getApprovedContent) });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/public/flows", async (_req, res) => {
    try {
      res.json({
        items: await readPublicCache("flows", getUpcomingPublicFlows),
      });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  // --- Notion webhook: cache invalidation only -----------------------------

  app.post("/api/webhooks/notion", async (req, res) => {
    const verificationToken = req.body?.verification_token;
    if (verificationToken) {
      res.status(202).json({
        received: true,
        message:
          "Verification token received. Configure it as NOTION_WEBHOOK_VERIFICATION_TOKEN before activating this subscription.",
      });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (
      !rawBody ||
      !verifyNotionWebhookSignature(
        rawBody,
        req.header("x-notion-signature"),
        notionConfig.webhookVerificationToken
      )
    ) {
      res.status(401).json({ error: "Invalid Notion webhook signature." });
      return;
    }

    const sourceId =
      req.body?.data_source_id ??
      req.body?.entity?.data_source_id ??
      req.body?.parent?.data_source_id;

    // Only CONTENT and FLOWS feed the public cache. MONEY must never be here.
    const publicSourceIds = [
      notionConfig.dataSourceIds.content,
      notionConfig.dataSourceIds.flows,
    ];
    for (const id of publicSourceIds) {
      assertMoneyNeverPublic(id, notionConfig.dataSourceIds.money);
    }

    if (!sourceId || new Set(publicSourceIds).has(sourceId)) {
      invalidatePublicCache();
    }
    res.status(202).json({ received: true });
  });

  // --- Team: authenticated reads ------------------------------------------

  app.get("/api/team/profile", async (req, res) => {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    try {
      res.json(await getTeamProfile(user));
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/flows", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({ items: await listFlows() });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/moves", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({ items: await listMoves() });
    } catch (error) {
      errorResponse(error, res);
    }
  });

  app.get("/api/team/content", async (req, res) => {
    if (!(await requireAuthenticatedUser(req, res))) return;
    try {
      res.json({
        items: await listDataSourceRecords(notionConfig.dataSourceIds.content),
      });
    } catch (error) {
      errorResponse(error, res);
    }
  });
}

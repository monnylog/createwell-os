import { notionPageToRecord, queryDataSource } from "./client";
import { notionConfig } from "./config";

type NotionQueryResponse = { results?: any[] };

export type CreateWellRecord = ReturnType<typeof notionPageToRecord>;

const V3_PAUSED = (feature: string, reason: string) =>
  new Error(`${feature} is paused in Create Well OS v3 — ${reason}`);

export type PublicContentRecord = {
  id: string;
  name: string;
  contentType: string;
  copy: string;
  publishDate: string;
  url: string;
};

export type PublicFlowRecord = {
  id: string;
  name: string;
  type: string;
  date: string;
  venue: string;
};

export type TeamFlowRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  phase: string;
  date: string;
  venue: string;
  mediaCutoff: string;
  driveFolder: string;
};

/** A Flow is publicly listable only in these states. */
const PUBLIC_FLOW_STATUSES = new Set(["scheduled", "ready", "approved"]);

export async function listDataSourceRecords(dataSourceId: string) {
  const response = await queryDataSource<NotionQueryResponse>(dataSourceId, { page_size: 100 });
  return (response.results ?? []).map(notionPageToRecord);
}

function propertyValue(properties: Record<string, any>, name: string): string {
  const property = properties[name];
  if (!property) return "";
  if (property.type === "select" || property.type === "status") return property[property.type]?.name ?? "";
  if (property.type === "rich_text") return property.rich_text?.map((item: any) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "title") return property.title?.map((item: any) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "date") return property.date?.start ?? "";
  if (property.type === "email") return property.email ?? "";
  if (property.type === "url") return property.url ?? "";
  if (property.type === "number") return property.number == null ? "" : String(property.number);
  return "";
}

function checkboxValue(properties: Record<string, any>, name: string): boolean {
  return properties[name]?.checkbox === true;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Public CONTENT: Status = Published AND Audience = Public.
 *
 * `Notes` (internal editorial commentary) and `Where` (production wiring) are
 * never returned. `Final?` is asset-specific and is not a global gate.
 */
export async function getApprovedContent() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.content);
  return records
    .filter(record => {
      const status = normalize(propertyValue(record.properties, "Status"));
      const audience = normalize(propertyValue(record.properties, "Audience"));
      return status === "published" && audience === "public";
    })
    .map<PublicContentRecord>(record => ({
      id: record.id,
      name: propertyValue(record.properties, "Name") || record.name,
      contentType: propertyValue(record.properties, "Content Type"),
      copy: propertyValue(record.properties, "Copy"),
      publishDate: propertyValue(record.properties, "Publish Date"),
      url: propertyValue(record.properties, "URL"),
    }));
}

/**
 * Public FLOWS. The `Public?` checkbox alone is insufficient: a Flow can be
 * flagged public while still an Idea, or long since Cancelled. Happened and
 * Wrapped are excluded even when recent — this surface is upcoming
 * programming, not an archive. Internal Flows are never public.
 *
 * Returns public-safe fields only. Notes, Retro, Drive Folder, Media Cutoff,
 * Hard Stop, Capacity, Phase, and every PEOPLE/MONEY relation are withheld.
 */
export async function getUpcomingPublicFlows() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.flows);
  const today = todayIso();
  return records
    .filter(record => {
      if (!checkboxValue(record.properties, "Public?")) return false;
      if (normalize(propertyValue(record.properties, "Type")) === "internal") return false;
      if (!PUBLIC_FLOW_STATUSES.has(normalize(propertyValue(record.properties, "Status")))) return false;
      const date = propertyValue(record.properties, "Date");
      return Boolean(date) && date >= today;
    })
    .sort((left, right) =>
      propertyValue(left.properties, "Date").localeCompare(propertyValue(right.properties, "Date")),
    )
    .map<PublicFlowRecord>(record => ({
      id: record.id,
      name: propertyValue(record.properties, "Name") || record.name,
      type: propertyValue(record.properties, "Type"),
      date: propertyValue(record.properties, "Date"),
      venue: propertyValue(record.properties, "Venue"),
    }));
}

/**
 * Team-facing FLOWS read. Authenticated callers only.
 *
 * Includes Phase — the production-stage axis, orthogonal to Status. Status
 * answers "is this real?"; Phase answers "what work is live right now?"
 */
export async function listFlows() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.flows);
  return records
    .filter(record => normalize(propertyValue(record.properties, "Status")) !== "cancelled")
    .map<TeamFlowRecord>(record => ({
      id: record.id,
      name: propertyValue(record.properties, "Name") || record.name,
      type: propertyValue(record.properties, "Type"),
      status: propertyValue(record.properties, "Status"),
      phase: propertyValue(record.properties, "Phase"),
      date: propertyValue(record.properties, "Date"),
      venue: propertyValue(record.properties, "Venue"),
      mediaCutoff: propertyValue(record.properties, "Media Cutoff"),
      driveFolder: propertyValue(record.properties, "Drive Folder"),
    }));
}

/** MOVES. `Now` or `Next` IS the priority; `Dropped` is a real outcome. */
export async function listMoves() {
  return listDataSourceRecords(notionConfig.dataSourceIds.moves);
}

export function findTeamPersonRecord(records: CreateWellRecord[], user: { name: string | null; email: string | null }) {
  const email = normalize(user.email ?? "");
  const name = normalize(user.name ?? "");
  const match = records.find(record => {
    const recordEmail = normalize(propertyValue(record.properties, "Email"));
    const recordName = normalize(record.name);
    return (email && recordEmail === email) || (name && recordName === name);
  });

  if (!match) {
    throw new Error("Your account is not linked to a Create Well People record. Add a matching email or name before submitting.");
  }

  return match;
}

export async function getTeamProfile(user: { name: string | null; email: string | null }) {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.people);
  const match = findTeamPersonRecord(records, user);
  const matchedBy = normalize(match.email) === normalize(user.email ?? "") && Boolean(user.email) ? "email" : "name";
  return {
    personPageId: match.id,
    name: match.name || user.name || "Create Well team member",
    email: user.email ?? match.email,
    role: match.role || "Team member",
    notes: propertyValue(match.properties, "Notes"),
    linkedBy: matchedBy as "email" | "name",
  };
}

export async function resolvePersonPageId(user: { name: string | null; email: string | null }) {
  const profile = await getTeamProfile(user);
  return profile.personPageId;
}

// ---------------------------------------------------------------------------
// Paused in v3.
//
// These are kept as explicit failures rather than deleted so a future caller
// gets an explanatory error instead of a mysterious 404, and so the pause is
// legible in code and not only in docs/v3-domain-map.md.
// ---------------------------------------------------------------------------

export async function createTopicWellDrop(_input: unknown): Promise<never> {
  throw V3_PAUSED(
    "Topic Well intake",
    "a drop becomes a CONTENT draft, a FLOWS Idea, or a page body. No separate database.",
  );
}

export async function createTask(_input: unknown, _personPageId: string): Promise<never> {
  throw V3_PAUSED(
    "Creating Moves from the app",
    "this branch is read-only. Notion writes; the repo remembers; the site reads.",
  );
}

export async function listCheckIns(_personPageId: string): Promise<never> {
  throw V3_PAUSED("Check-ins", "no database home assigned yet. The budget is five databases.");
}

export async function createCheckIn(
  _input: unknown,
  _personPageId: string,
  _userName: string | null,
): Promise<never> {
  throw V3_PAUSED("Check-ins", "no database home assigned yet. The budget is five databases.");
}

export async function listNeeds(): Promise<never> {
  throw V3_PAUSED("Needs", "these stay private and page-based until the permission model is proven.");
}

export async function listDecisions(): Promise<never> {
  throw V3_PAUSED("Decisions", "these stay private and page-based until the permission model is proven.");
}

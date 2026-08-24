// Create Well OS v3 read models.
//
// Read-only projections over the five live databases. No writes, no Notion
// credentials, no network calls in this module — SQL builders and pure mappers
// only, so they can be unit tested against fixtures.
//
// Notion writes. The repo remembers. The site reads. Nothing writes backward.

export const V3_DATA_SOURCES = {
  people: "b97bcbdf-2b1b-488d-9d07-4012b031732e",
  flows: "c1677843-dd13-4e37-9f80-e960b26847dc",
  moves: "5597e583-f7df-4f6c-90b0-296a26c57454",
  money: "55832c19-38fa-44cb-b4c2-0174b4c5b207",
  content: "cd410d33-8052-4897-8226-3a3ca84ea8bc",
} as const;

export const FLOW_TYPES = [
  "Podyap",
  "Open Studio",
  "Book Club",
  "Workshop",
  "Pop-Up",
  "Surprise-ment",
  "Geyser",
  "Internal",
] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

/** Layers that may ever appear on a public surface. `Internal` never does. */
export const PUBLIC_FLOW_TYPES = FLOW_TYPES.filter((t) => t !== "Internal");

export const FLOW_STATUSES = [
  "Idea",
  "Scheduled",
  "Ready",
  "Approved",
  "Happened",
  "Wrapped",
  "Cancelled",
] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

/**
 * A Flow is publicly listable only in these states. `Idea` is not yet real,
 * and `Happened` / `Wrapped` / `Cancelled` are not upcoming.
 */
export const PUBLIC_FLOW_STATUSES: FlowStatus[] = [
  "Scheduled",
  "Ready",
  "Approved",
];

/**
 * The event flow. A second axis, orthogonal to Status: Status answers "is this
 * real?", Phase answers "what work is live right now?" A workshop can be
 * Approved and in Marketing; a Geyser can be Wrapped and in Depanty.
 *
 * Internal production state — never public.
 */
export const FLOW_PHASES = [
  "Cohoe",
  "Concepting",
  "Coordinating",
  "Marketing",
  "Day of",
  "Decomprocessing",
  "Depanty",
] as const;
export type FlowPhase = (typeof FLOW_PHASES)[number];

/** Phases that mean promotion has not started yet. */
export const PRE_MARKETING_PHASES: FlowPhase[] = ["Cohoe", "Concepting"];

export const MOVE_STATUSES = ["Now", "Next", "Done", "Dropped"] as const;
export type MoveStatus = (typeof MOVE_STATUSES)[number];

/** `Now` or `Next` IS the priority. Nothing else belongs on a work surface. */
export const ACTIVE_MOVE_STATUSES: MoveStatus[] = ["Now", "Next"];

export const MOVE_TYPES = [
  "Prep",
  "Day-Of",
  "Follow-Up",
  "Admin",
  "Content",
] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export const CONTENT_TYPES = [
  "Editorial Note",
  "Field Note",
  "Episode Copy",
  "Event Copy",
  "Resource",
  "Asset Link",
  "Promo",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentStatus = "Draft" | "Ready" | "Published" | "Archived";
export type ContentAudience = "Public" | "Team";

// ---------------------------------------------------------------------------
// Public read models
// ---------------------------------------------------------------------------

export type PublicContent = {
  id: string;
  name: string;
  contentType: ContentType | null;
  copy: string | null;
  publishDate: string | null;
  url: string | null;
};

/** Note the absence of `phase`. Production stage is not published. */
export type PublicFlow = {
  id: string;
  name: string;
  type: FlowType | null;
  date: string | null;
  venue: string | null;
};

// ---------------------------------------------------------------------------
// Team read models
// ---------------------------------------------------------------------------

export type TeamFlow = {
  id: string;
  name: string;
  type: FlowType | null;
  status: FlowStatus | null;
  phase: FlowPhase | null;
  date: string | null;
  venue: string | null;
  mediaCutoff: string | null;
  driveFolder: string | null;
};

export type TeamMove = {
  id: string;
  name: string;
  type: MoveType | null;
  status: Extract<MoveStatus, "Now" | "Next"> | null;
  due: string | null;
  blockedBy: string | null;
  flowId: string | null;
};

export type ThisWeekAtTheWell = {
  flows: TeamFlow[];
  myMoves: TeamMove[];
  /** Stale beats wrong. Never render a number the system is unsure about. */
  lastGoodSyncAt: string | null;
  stale: boolean;
};

// ---------------------------------------------------------------------------
// Raw row shape
// ---------------------------------------------------------------------------

/** A row as returned by a Notion data-source query. Untyped at the boundary. */
export type RawRow = Record<string, unknown>;

function str(row: RawRow, key: string): string | null {
  const value = row[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function checkbox(row: RawRow, key: string): boolean {
  return row[key] === "__YES__" || row[key] === true;
}

function firstRelation(row: RawRow, key: string): string | null {
  const value = row[key];
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : null;
  }
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    } catch {
      return null;
    }
  }
  return null;
}

function relations(row: RawRow, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    } catch {
      return [];
    }
  }
  return [];
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

// ---------------------------------------------------------------------------
// SQL builders
// ---------------------------------------------------------------------------

function quoted(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

function source(id: string): string {
  return `"collection://${id}"`;
}

/**
 * Public CONTENT.
 *
 * `Final?` is deliberately NOT part of this gate. It is asset-specific — "the
 * only status that matters for an asset" — and requiring it globally would
 * silently hide published Editorial Notes and Episode Copy that never needed
 * an asset checkbox. Asset-level enforcement lives in `assetRequiresFinal`.
 */
export function publicContentSql(): string {
  return [
    "SELECT url, \"Name\", \"Content Type\", \"Copy\",",
    "       \"date:Publish Date:start\", \"userDefined:URL\", \"Final?\"",
    `FROM ${source(V3_DATA_SOURCES.content)}`,
    "WHERE \"Status\" = 'Published'",
    "  AND \"Audience\" = 'Public'",
    "ORDER BY \"date:Publish Date:start\" DESC",
  ].join("\n");
}

/**
 * Public FLOWS.
 *
 * `Public?` alone is insufficient: a Flow can be flagged public while still an
 * `Idea`, or long since `Cancelled`. The compound gate requires an actionable
 * status AND a future date. `Happened` and `Wrapped` are excluded even when
 * recent — the public surface is upcoming programming, not an archive.
 *
 * `Phase` is deliberately not selected. Production stage is internal.
 */
export function publicFlowsSql(todayIso: string): string {
  return [
    "SELECT url, \"Name\", \"Type\", \"date:Date:start\", \"Venue\"",
    `FROM ${source(V3_DATA_SOURCES.flows)}`,
    "WHERE \"Public?\" = '__YES__'",
    `  AND "Status" IN (${quoted(PUBLIC_FLOW_STATUSES)})`,
    `  AND "Type" IN (${quoted(PUBLIC_FLOW_TYPES)})`,
    `  AND "date:Date:start" >= '${todayIso}'`,
    "ORDER BY \"date:Date:start\" ASC",
  ].join("\n");
}

/** Team-facing Flows inside a date window. Authenticated callers only. */
export function teamFlowsThisWeekSql(startIso: string, endIso: string): string {
  return [
    "SELECT url, \"Name\", \"Type\", \"Status\", \"Phase\", \"date:Date:start\",",
    "       \"Venue\", \"date:Media Cutoff:start\", \"Drive Folder\"",
    `FROM ${source(V3_DATA_SOURCES.flows)}`,
    `WHERE "date:Date:start" >= '${startIso}'`,
    `  AND "date:Date:start" <= '${endIso}'`,
    "  AND \"Status\" != 'Cancelled'",
    "ORDER BY \"date:Date:start\" ASC",
  ].join("\n");
}

/**
 * Flows whose date is inside four weeks but whose Phase says promotion has not
 * started. The operations guide sets a hard marketing start around four weeks
 * out, with the date secured at least a month prior — so this is the
 * "marketing should have started" alarm, not a nag.
 */
export function needsMarketingSql(todayIso: string, fourWeeksOutIso: string): string {
  return [
    "SELECT url, \"Name\", \"Type\", \"Status\", \"Phase\", \"date:Date:start\"",
    `FROM ${source(V3_DATA_SOURCES.flows)}`,
    `WHERE "date:Date:start" >= '${todayIso}'`,
    `  AND "date:Date:start" <= '${fourWeeksOutIso}'`,
    "  AND \"Status\" != 'Cancelled'",
    `  AND ("Phase" IS NULL OR "Phase" IN (${quoted(PRE_MARKETING_PHASES)}))`,
    "ORDER BY \"date:Date:start\" ASC",
  ].join("\n");
}

/**
 * One person's active Moves. The caller must pass the PEOPLE page URL resolved
 * from the authenticated session — never a value taken from a request param.
 */
export function myMovesSql(personPageUrl: string): string {
  const needle = personPageUrl.replace(/'/g, "''");
  return [
    "SELECT url, \"Name\", \"Type\", \"Status\", \"date:Due:start\",",
    "       \"Blocked By\", \"Flow\"",
    `FROM ${source(V3_DATA_SOURCES.moves)}`,
    `WHERE "Status" IN (${quoted(ACTIVE_MOVE_STATUSES)})`,
    `  AND "Owner" LIKE '%${needle}%'`,
    "ORDER BY \"date:Due:start\" ASC",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toPublicContent(row: RawRow): PublicContent {
  return {
    id: str(row, "url") ?? "",
    name: str(row, "Name") ?? "",
    contentType: oneOf(str(row, "Content Type"), CONTENT_TYPES),
    copy: str(row, "Copy"),
    publishDate: str(row, "date:Publish Date:start"),
    url: str(row, "userDefined:URL"),
  };
}

/** Public-safe fields only. Phase is intentionally absent. */
export function toPublicFlow(row: RawRow): PublicFlow {
  return {
    id: str(row, "url") ?? "",
    name: str(row, "Name") ?? "",
    type: oneOf(str(row, "Type"), FLOW_TYPES),
    date: str(row, "date:Date:start"),
    venue: str(row, "Venue"),
  };
}

export function toTeamFlow(row: RawRow): TeamFlow {
  return {
    id: str(row, "url") ?? "",
    name: str(row, "Name") ?? "",
    type: oneOf(str(row, "Type"), FLOW_TYPES),
    status: oneOf(str(row, "Status"), FLOW_STATUSES),
    phase: oneOf(str(row, "Phase"), FLOW_PHASES),
    date: str(row, "date:Date:start"),
    venue: str(row, "Venue"),
    mediaCutoff: str(row, "date:Media Cutoff:start"),
    driveFolder: str(row, "Drive Folder"),
  };
}

export function toTeamMove(row: RawRow): TeamMove {
  const status = oneOf(str(row, "Status"), MOVE_STATUSES);
  return {
    id: str(row, "url") ?? "",
    name: str(row, "Name") ?? "",
    type: oneOf(str(row, "Type"), MOVE_TYPES),
    status: status === "Now" || status === "Next" ? status : null,
    due: str(row, "date:Due:start"),
    blockedBy: str(row, "Blocked By"),
    flowId: firstRelation(row, "Flow"),
  };
}

/**
 * True when a Flow is close enough that promotion should be underway but its
 * Phase says it is not. A blank Phase counts as not started.
 */
export function isMarketingOverdue(row: RawRow, todayIso: string, fourWeeksOutIso: string): boolean {
  const date = str(row, "date:Date:start") ?? str(row, "Date");
  if (!date) return false;
  if (date < todayIso || date > fourWeeksOutIso) return false;
  if (str(row, "Status") === "Cancelled") return false;
  const phase = oneOf(str(row, "Phase"), FLOW_PHASES);
  return phase === null || PRE_MARKETING_PHASES.includes(phase);
}

/**
 * `Final?` gates asset rendering only. An `Asset Link` that is not final must
 * not be surfaced as a usable asset even when its row is Published/Public.
 */
export function assetRequiresFinal(row: RawRow): boolean {
  return str(row, "Content Type") === "Asset Link";
}

export function isRenderableAsset(row: RawRow): boolean {
  return assetRequiresFinal(row) ? checkbox(row, "Final?") : true;
}

/** True when a Move belongs to the given PEOPLE page URL. Defense in depth. */
export function moveBelongsToPerson(row: RawRow, personPageUrl: string): boolean {
  return relations(row, "Owner").includes(personPageUrl);
}

/** Stale beats wrong: surface the last good sync rather than a fresh guess. */
export function withStaleness<T>(
  payload: T,
  lastGoodSyncAt: string | null,
  isStale: boolean,
): T & { lastGoodSyncAt: string | null; stale: boolean } {
  return { ...payload, lastGoodSyncAt, stale: isStale };
}

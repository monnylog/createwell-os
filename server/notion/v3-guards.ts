// Public payload guards for Create Well OS v3.
//
// The five databases hold operational and relational truth. Only a narrow
// projection of FLOWS and CONTENT is ever public. These guards are the last
// line before a response leaves the server: a deny-list applied to the
// serialized payload, independent of whatever the query happened to select.

/**
 * Fields that must never appear in a public FLOWS payload.
 *
 * Notes and Retro are internal reflection. Drive Folder, Media Cutoff, and
 * Hard Stop are production logistics. Guests, Attended, Support, and Flow
 * Keeper are PEOPLE relations — publishing them would leak the relationship
 * graph. Money is a MONEY relation. Capacity is withheld by default because a
 * bare number invites misreading as availability.
 *
 * Phase is internal production stage. A Flow deep in Marketing is exactly when
 * it should be public — but which phase the team is in is not the community's
 * business. Publication is gated by Public? + Status + a future date; Phase
 * never participates in that decision.
 */
export const PUBLIC_FLOW_DENIED_FIELDS = [
  "Notes",
  "Retro",
  "Drive Folder",
  "Media Cutoff",
  "date:Media Cutoff:start",
  "Hard Stop",
  "Money",
  "Guests",
  "Attended",
  "Support",
  "Flow Keeper",
  "Moves",
  "Capacity",
  "Phase",
  "notes",
  "retro",
  "driveFolder",
  "mediaCutoff",
  "hardStop",
  "money",
  "guests",
  "attended",
  "support",
  "flowKeeper",
  "moves",
  "capacity",
  "phase",
] as const;

/**
 * Fields that must never appear in a public CONTENT payload.
 *
 * Notes is internal editorial commentary. Flow and Where describe internal
 * production wiring rather than anything a reader needs.
 */
export const PUBLIC_CONTENT_DENIED_FIELDS = [
  "Notes",
  "Flow",
  "Where",
  "notes",
  "flow",
  "where",
] as const;

/** PEOPLE, MOVES, and MONEY have no public projection at all. */
export const PRIVATE_ONLY_SOURCES = ["people", "moves", "money"] as const;

/** MONEY has no public route by design. The only proof is a failing attempt. */
export const MONEY_HAS_NO_PUBLIC_ROUTE = true as const;

export class PublicPayloadLeakError extends Error {
  constructor(
    readonly field: string,
    readonly surface: string,
  ) {
    super(`Denied field "${field}" would leak through the ${surface} surface`);
    this.name = "PublicPayloadLeakError";
  }
}

function keysOf(payload: unknown): string[] {
  if (payload === null || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload.flatMap(keysOf);
  const record = payload as Record<string, unknown>;
  return Object.keys(record).concat(Object.values(record).flatMap(keysOf));
}

/** Throws on the first denied field found anywhere in the payload tree. */
export function assertNoDeniedFields(
  payload: unknown,
  denied: readonly string[],
  surface: string,
): void {
  const present = new Set(keysOf(payload));
  for (const field of denied) {
    if (present.has(field)) throw new PublicPayloadLeakError(field, surface);
  }
}

function omit<T extends Record<string, unknown>>(
  value: T,
  denied: readonly string[],
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (denied.includes(key)) continue;
    out[key] = entry;
  }
  return out as Partial<T>;
}

export function scrubPublicFlow<T extends Record<string, unknown>>(flow: T): Partial<T> {
  const scrubbed = omit(flow, PUBLIC_FLOW_DENIED_FIELDS);
  assertNoDeniedFields(scrubbed, PUBLIC_FLOW_DENIED_FIELDS, "public flows");
  return scrubbed;
}

export function scrubPublicContent<T extends Record<string, unknown>>(item: T): Partial<T> {
  const scrubbed = omit(item, PUBLIC_CONTENT_DENIED_FIELDS);
  assertNoDeniedFields(scrubbed, PUBLIC_CONTENT_DENIED_FIELDS, "public content");
  return scrubbed;
}

/** Call from any public route factory. MONEY must never be reachable. */
export function assertMoneyNeverPublic(dataSourceId: string, moneyId: string): void {
  if (dataSourceId === moneyId) {
    throw new Error("MONEY has no public route in Create Well OS v3");
  }
}

/**
 * A Move may only be returned to the person who owns it. `sessionPersonUrl`
 * must come from the authenticated session, never from a request parameter.
 */
export function assertMoveOwnership(
  moveOwnerUrls: readonly string[],
  sessionPersonUrl: string,
): void {
  if (!moveOwnerUrls.includes(sessionPersonUrl)) {
    throw new Error("A Move may only be read by its owner");
  }
}

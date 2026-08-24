/**
 * Create Well OS v3 — the five databases.
 *
 * Notion writes. The repo remembers. The site reads. Nothing writes backward.
 * The budget is fixed: five databases. A sixth requires deleting one.
 *
 * Retired 2026-08-22: Offers (now the FLOWS.Type select), Podcast Episodes,
 * Workshop Sessions, Book Club Sessions, Topic Well, Check-ins, Needs,
 * Decisions, Partner Organizations. Do not reintroduce them here.
 */
const requiredDataSourceIds = {
  people: process.env.NOTION_PEOPLE_DATA_SOURCE_ID ?? "b97bcbdf-2b1b-488d-9d07-4012b031732e",
  flows: process.env.NOTION_FLOWS_DATA_SOURCE_ID ?? "c1677843-dd13-4e37-9f80-e960b26847dc",
  moves: process.env.NOTION_MOVES_DATA_SOURCE_ID ?? "5597e583-f7df-4f6c-90b0-296a26c57454",
  money: process.env.NOTION_MONEY_DATA_SOURCE_ID ?? "55832c19-38fa-44cb-b4c2-0174b4c5b207",
  content: process.env.NOTION_CONTENT_DATA_SOURCE_ID ?? "cd410d33-8052-4897-8226-3a3ca84ea8bc",
} as const;

export type NotionDataSourceKey = keyof typeof requiredDataSourceIds;

/**
 * Sources with no public projection, ever. MONEY is declared in this config so
 * the public-route guard can name and refuse it — not so it can be served.
 */
export const PRIVATE_ONLY_KEYS = ["people", "moves", "money"] as const;

export const notionConfig = {
  apiToken: process.env.NOTION_API_TOKEN ?? "",
  webhookVerificationToken: process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN ?? "",
  dataSourceIds: requiredDataSourceIds,
} as const;

export function assertNotionConfiguration() {
  if (!notionConfig.apiToken) {
    throw new Error("NOTION_API_TOKEN is required for Create Well server-side synchronization.");
  }
  for (const [key, id] of Object.entries(notionConfig.dataSourceIds)) {
    if (!id) {
      throw new Error(`Missing Notion data source id for ${key}.`);
    }
  }
}

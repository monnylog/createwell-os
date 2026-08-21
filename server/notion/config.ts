const requiredDataSourceIds = {
  people: process.env.NOTION_PEOPLE_DATA_SOURCE_ID ?? "b97bcbdf-2b1b-488d-9d07-4012b031732e",
  offers: process.env.NOTION_OFFERS_DATA_SOURCE_ID ?? "78cc2f26-9609-4351-9895-3ba7e86d1d03",
  events: process.env.NOTION_EVENTS_DATA_SOURCE_ID ?? "c1677843-dd13-4e37-9f80-e960b26847dc",
  tasks: process.env.NOTION_TASKS_DATA_SOURCE_ID ?? "5597e583-f7df-4f6c-90b0-296a26c57454",
  content: process.env.NOTION_CONTENT_DATA_SOURCE_ID ?? "cd410d33-8052-4897-8226-3a3ca84ea8bc",
  topicWell: process.env.NOTION_TOPIC_WELL_DATA_SOURCE_ID ?? "5422b951-23e0-4fa0-b4a3-6f6619759ff2",
  checkIns: process.env.NOTION_CHECK_INS_DATA_SOURCE_ID ?? "b2d174dd-9294-4200-996d-d895dfcaac31",
  decisions: process.env.NOTION_DECISIONS_DATA_SOURCE_ID ?? "219fda27-ee36-4774-929b-30b2e16180e3",
  needs: process.env.NOTION_NEEDS_DATA_SOURCE_ID ?? "c957ab5f-4cb9-4000-b96e-1665d288b909",
} as const;

export const notionConfig = {
  apiToken: process.env.NOTION_API_TOKEN ?? "",
  webhookVerificationToken: process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN ?? "",
  dataSourceIds: requiredDataSourceIds,
} as const;

export function assertNotionConfiguration() {
  if (!notionConfig.apiToken) {
    throw new Error("NOTION_API_TOKEN is required for Create Well server-side synchronization.");
  }
}

import { assertNotionConfiguration, notionConfig } from "./config";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

type NotionRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

export async function notionRequest<T>(path: string, init: NotionRequestInit = {}): Promise<T> {
  assertNotionConfiguration();

  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionConfig.apiToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new NotionApiError("Notion request failed", response.status, body);
  }

  return body as T;
}

export async function queryDataSource<T>(
  dataSourceId: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  return notionRequest<T>(`/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPage<T>(parentDataSourceId: string, properties: Record<string, unknown>): Promise<T> {
  return notionRequest<T>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { data_source_id: parentDataSourceId },
      properties,
    }),
  });
}

export const notionProperty = {
  title: (value: string) => ({ title: [{ type: "text", text: { content: value } }] }),
  richText: (value: string) => ({ rich_text: value ? [{ type: "text", text: { content: value } }] : [] }),
  select: (value: string) => ({ select: { name: value } }),
  checkbox: (value: boolean) => ({ checkbox: value }),
  date: (value: string) => ({ date: { start: value } }),
  relation: (pageId: string) => ({ relation: [{ id: pageId }] }),
};

function textFromFragments(fragments: Array<{ plain_text?: string }> | undefined) {
  return fragments?.map(fragment => fragment.plain_text ?? "").join("") ?? "";
}

export function notionPageToRecord(page: any) {
  const properties = page.properties ?? {};
  const readText = (name: string) => {
    const property = properties[name];
    if (!property) return "";
    if (property.type === "title") return textFromFragments(property.title);
    if (property.type === "rich_text") return textFromFragments(property.rich_text);
    if (property.type === "select" || property.type === "status") return property[property.type]?.name ?? "";
    if (property.type === "date") return property.date?.start ?? "";
    if (property.type === "checkbox") return Boolean(property.checkbox);
    return property[property.type] ?? "";
  };

  return {
    id: page.id,
    url: page.url,
    name: String(readText("Name")),
    status: String(readText("Status")),
    type: String(readText("Type") || readText("Content Type") || readText("Event Type")),
    phase: String(readText("Phase")),
    priority: String(readText("Priority")),
    nextAction: String(readText("Next Action")),
    mood: String(readText("Mood")),
    absorption: String(readText("Absorption")),
    bodyStatus: String(readText("Body Status")),
    category: String(readText("Category") || readText("Domain")),
    summary: String(readText("Summary") || readText("Copy") || readText("Notes") || readText("Drop")),
    start: String(readText("Start")),
    end: String(readText("End")),
    publishDate: String(readText("Publish Date")),
    properties,
  };
}

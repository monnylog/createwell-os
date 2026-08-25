import { assertNotionConfiguration, notionConfig } from "./config";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";
const DEFAULT_PAGE_SIZE = 100;

/** HTTP status codes that are safe to retry automatically. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 30_000;

type NotionRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

function retryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, RETRY_MAX_MS);
    }
  }
  // Exponential backoff with up to 50% random jitter.
  const exponential = RETRY_BASE_MS * 2 ** attempt;
  const jitter = Math.random() * 0.5 * exponential;
  return Math.min(exponential + jitter, RETRY_MAX_MS);
}

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

export async function notionRequest<T>(
  path: string,
  init: NotionRequestInit = {}
): Promise<T> {
  assertNotionConfiguration();

  let attempt = 0;
  while (true) {
    const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${notionConfig.apiToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (response.ok) {
      const body = await response.json().catch(() => undefined);
      return body as T;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryDelayMs(attempt, retryAfter);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt += 1;
      continue;
    }

    const body = await response.json().catch(() => undefined);
    throw new NotionApiError("Notion request failed", response.status, body);
  }
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

type NotionPaginatedResponse<T> = {
  results?: T[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export async function queryAllDataSourceResults<T>(
  dataSourceId: string,
  payload: Record<string, unknown> = {}
): Promise<T[]> {
  const results: T[] = [];
  let nextCursor: string | null | undefined = undefined;

  do {
    const response: NotionPaginatedResponse<T> = await queryDataSource<
      NotionPaginatedResponse<T>
    >(dataSourceId, {
      page_size: DEFAULT_PAGE_SIZE,
      ...payload,
      ...(nextCursor ? { start_cursor: nextCursor } : {}),
    });

    results.push(...(response.results ?? []));
    if (response.has_more) {
      if (!response.next_cursor) {
        throw new Error(
          "Notion returned has_more: true without a next_cursor — cannot paginate safely."
        );
      }
      nextCursor = response.next_cursor;
    } else {
      nextCursor = null;
    }
  } while (nextCursor);

  return results;
}

export async function listBlockChildren<T>(
  blockId: string,
  startCursor?: string | null
): Promise<NotionPaginatedResponse<T>> {
  const query = new URLSearchParams({
    page_size: String(DEFAULT_PAGE_SIZE),
  });
  if (startCursor) query.set("start_cursor", startCursor);
  return notionRequest<NotionPaginatedResponse<T>>(
    `/blocks/${blockId}/children?${query.toString()}`
  );
}

export async function listAllBlockChildren<T>(blockId: string): Promise<T[]> {
  const results: T[] = [];
  let nextCursor: string | null | undefined = undefined;

  do {
    const response: NotionPaginatedResponse<T> = await listBlockChildren<T>(
      blockId,
      nextCursor
    );
    results.push(...(response.results ?? []));
    if (response.has_more) {
      if (!response.next_cursor) {
        throw new Error(
          "Notion returned has_more: true without a next_cursor — cannot paginate safely."
        );
      }
      nextCursor = response.next_cursor;
    } else {
      nextCursor = null;
    }
  } while (nextCursor);

  return results;
}

export async function createPage<T>(
  parentDataSourceId: string,
  properties: Record<string, unknown>
): Promise<T> {
  return notionRequest<T>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { data_source_id: parentDataSourceId },
      properties,
    }),
  });
}

export const notionProperty = {
  title: (value: string) => ({
    title: [{ type: "text", text: { content: value } }],
  }),
  richText: (value: string) => ({
    rich_text: value ? [{ type: "text", text: { content: value } }] : [],
  }),
  select: (value: string) => ({ select: { name: value } }),
  checkbox: (value: boolean) => ({ checkbox: value }),
  date: (value: string) => ({ date: { start: value } }),
  relation: (pageId: string) => ({ relation: [{ id: pageId }] }),
};

function textFromFragments(
  fragments: Array<{ plain_text?: string }> | undefined
) {
  return fragments?.map(fragment => fragment.plain_text ?? "").join("") ?? "";
}

export function notionPageToRecord(page: any) {
  const properties = page.properties ?? {};
  const readText = (name: string) => {
    const property = properties[name];
    if (!property) return "";
    if (property.type === "title") return textFromFragments(property.title);
    if (property.type === "rich_text")
      return textFromFragments(property.rich_text);
    if (property.type === "select" || property.type === "status")
      return property[property.type]?.name ?? "";
    if (property.type === "date") return property.date?.start ?? "";
    if (property.type === "checkbox") return Boolean(property.checkbox);
    if (property.type === "email") return property.email ?? "";
    return property[property.type] ?? "";
  };

  return {
    id: page.id,
    url: page.url,
    name: String(readText("Name")),
    status: String(readText("Status")),
    type: String(
      readText("Type") || readText("Content Type") || readText("Event Type")
    ),
    phase: String(readText("Phase")),
    priority: String(readText("Priority")),
    nextAction: String(readText("Next Action")),
    mood: String(readText("Mood")),
    absorption: String(readText("Absorption")),
    bodyStatus: String(readText("Body Status")),
    category: String(readText("Category") || readText("Domain")),
    email: String(readText("Email")),
    role: String(readText("Role")),
    week: String(readText("Week")),
    summary: String(
      readText("Summary") ||
        readText("Copy") ||
        readText("Notes") ||
        readText("Drop")
    ),
    start: String(readText("Start")),
    end: String(readText("End")),
    publishDate: String(readText("Publish Date")),
    properties,
  };
}

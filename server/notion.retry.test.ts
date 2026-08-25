import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for retry/backoff behavior in the Notion API client.
 *
 * The client retries on 429, 500, 502, 503, 504, and 529, respects the
 * Retry-After header when present, and throws after MAX_RETRIES attempts.
 */

afterEach(() => {
  if ("NOTION_API_TOKEN" in process.env) delete process.env.NOTION_API_TOKEN;
  vi.restoreAllMocks();
  vi.resetModules();
});

function makeResponse(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

describe("Notion client retry / backoff", () => {
  beforeEach(() => {
    process.env.NOTION_API_TOKEN = "test-token";
    // Replace global setTimeout so retry delays don't slow the test suite.
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (fn: (...args: unknown[]) => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
    );
  });

  it("succeeds immediately when the first response is 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { notionRequest } = await import("./notion/client");
    const result = await notionRequest<{ ok: boolean }>("/test");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { message: "rate limited" }))
      .mockResolvedValueOnce(makeResponse(200, { id: "page-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { notionRequest } = await import("./notion/client");
    const result = await notionRequest<{ id: string }>("/test");

    expect(result).toEqual({ id: "page-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 500, 502, 503, 504, and 529", async () => {
    for (const status of [500, 502, 503, 504, 529]) {
      vi.resetModules();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeResponse(status))
        .mockResolvedValueOnce(makeResponse(200, { status }));
      vi.stubGlobal("fetch", fetchMock);

      const { notionRequest } = await import("./notion/client");
      const result = await notionRequest<{ status: number }>("/test");
      expect(result).toEqual({ status });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it("respects the Retry-After header delay", async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (fn: (...args: unknown[]) => void, delay?: number) => {
        delays.push(delay ?? 0);
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(429, {}, { "retry-after": "2" })
      )
      .mockResolvedValueOnce(makeResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    const { notionRequest } = await import("./notion/client");
    await notionRequest("/test");

    expect(delays[0]).toBe(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws NotionApiError after exhausting all retries", async () => {
    // Provide more than MAX_RETRIES (5) failing responses.
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    const { notionRequest, NotionApiError } = await import("./notion/client");
    await expect(notionRequest("/test")).rejects.toBeInstanceOf(NotionApiError);
    // 1 initial attempt + 5 retries = 6 total.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not retry on 400 or 404", async () => {
    for (const status of [400, 404]) {
      vi.resetModules();
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeResponse(status, { code: "not_found" }));
      vi.stubGlobal("fetch", fetchMock);

      const { notionRequest, NotionApiError } = await import("./notion/client");
      await expect(notionRequest("/test")).rejects.toBeInstanceOf(NotionApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("throws on has_more: true without next_cursor from queryAllDataSourceResults", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { results: [{ id: "a" }], has_more: true, next_cursor: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { queryAllDataSourceResults } = await import("./notion/client");
    await expect(
      queryAllDataSourceResults("source-id")
    ).rejects.toThrow(/cannot paginate safely/i);
  });

  it("throws on has_more: true without next_cursor from listAllBlockChildren", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { results: [{ id: "block-1" }], has_more: true, next_cursor: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listAllBlockChildren } = await import("./notion/client");
    await expect(listAllBlockChildren("page-id")).rejects.toThrow(
      /cannot paginate safely/i
    );
  });
});

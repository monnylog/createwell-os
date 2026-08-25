import { afterEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.NOTION_API_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.NOTION_API_TOKEN;
  } else {
    process.env.NOTION_API_TOKEN = originalToken;
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Notion client pagination", () => {
  it("returns every page from a paginated data-source query", async () => {
    process.env.NOTION_API_TOKEN = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "a" }],
          has_more: true,
          next_cursor: "cursor-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "b" }],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { queryAllDataSourceResults } = await import("./notion/client");
    const results = await queryAllDataSourceResults<{ id: string }>("source-id");

    expect(results).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("cursor-2");
  });

  it("returns every page of block children", async () => {
    process.env.NOTION_API_TOKEN = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "block-a" }],
          has_more: true,
          next_cursor: "cursor-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "block-b" }],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { listAllBlockChildren } = await import("./notion/client");
    const results = await listAllBlockChildren<{ id: string }>("page-id");

    expect(results).toEqual([{ id: "block-a" }, { id: "block-b" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("start_cursor=cursor-2");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.NOTION_API_TOKEN;

afterEach(() => {
  process.env.NOTION_API_TOKEN = originalToken;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Notion client pagination", () => {
  it("retrieves all paginated query results", async () => {
    process.env.NOTION_API_TOKEN = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "page-1" }],
          has_more: true,
          next_cursor: "cursor-1",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "page-2" }],
          has_more: false,
          next_cursor: null,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { queryAllDataSourceResults } = await import("./notion/client");
    const results = await queryAllDataSourceResults<{ id: string }>(
      "content-source"
    );

    expect(results.map(result => result.id)).toEqual(["page-1", "page-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: expect.stringContaining('"start_cursor":"cursor-1"'),
    });
  });

  it("retrieves all paginated block children", async () => {
    process.env.NOTION_API_TOKEN = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "block-1" }],
          has_more: true,
          next_cursor: "cursor-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: "block-2" }],
          has_more: false,
          next_cursor: null,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { listAllBlockChildren } = await import("./notion/client");
    const results = await listAllBlockChildren<{ id: string }>("page-1");

    expect(results.map(result => result.id)).toEqual(["block-1", "block-2"]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "start_cursor=cursor-2"
    );
  });
});

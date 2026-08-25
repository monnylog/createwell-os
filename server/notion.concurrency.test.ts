import { describe, expect, it } from "vitest";
import { syncPublishedContentToMdx, type NotionBlock } from "./notion/sync";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import type { CreateWellRecord } from "./notion/service";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "createwell-concurrency-test-")
  );
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))
  );
});

function richText(content: string) {
  return [{ type: "text", plain_text: content, text: { content } }];
}

function pageRecord(id: string, name: string): CreateWellRecord {
  return {
    id,
    url: `https://app.notion.com/${id}`,
    name,
    status: "Published",
    type: "Field Note",
    phase: "",
    priority: "",
    nextAction: "",
    mood: "",
    absorption: "",
    bodyStatus: "",
    category: "",
    email: "",
    role: "",
    week: "",
    summary: "",
    start: "",
    end: "",
    publishDate: "2026-08-25",
    properties: {
      "Content Type": { type: "select", select: { name: "Field Note" } },
      "Publish Date": { type: "date", date: { start: "2026-08-25" } },
    },
  };
}

describe("notion sync bounded concurrency", () => {
  it("fetches block children with bounded concurrency and preserves all content", async () => {
    const targetDir = await makeTempDir();
    const concurrentCalls: number[] = [];
    let active = 0;
    let maxObserved = 0;

    // Build a tree: root page has 20 children, each with 1 grandchild.
    const blockMap: Record<string, NotionBlock[]> = {};
    blockMap["page-1"] = Array.from({ length: 20 }, (_, i) => ({
      id: `parent-${i}`,
      type: "bulleted_list_item",
      has_children: true,
      bulleted_list_item: { rich_text: richText(`Parent ${i}`) },
    }));
    for (let i = 0; i < 20; i++) {
      blockMap[`parent-${i}`] = [
        {
          id: `child-${i}`,
          type: "paragraph",
          paragraph: { rich_text: richText(`Child ${i}`) },
        },
      ];
    }

    const listBlockChildren = async (blockId: string): Promise<NotionBlock[]> => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      concurrentCalls.push(active);
      // Yield to the event loop to allow concurrent tasks to accumulate.
      await new Promise(resolve => setImmediate(resolve));
      active--;
      return blockMap[blockId] ?? [];
    };

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [pageRecord("page-1", "Concurrency Test")],
        listBlockChildren,
      },
    });

    expect(result.applied).toBe(true);
    expect(result.counts.create).toBe(1);

    // With 20 sibling children needing their own requests in parallel,
    // concurrency should be bounded to BLOCK_CONCURRENCY (5).
    expect(maxObserved).toBeLessThanOrEqual(5);
    // All 21 requests (1 root + 20 children) must have been made.
    expect(concurrentCalls.length).toBe(21);
  });

  it("handles pages with no children without extra requests", async () => {
    const targetDir = await makeTempDir();
    let callCount = 0;

    const listBlockChildren = async (blockId: string): Promise<NotionBlock[]> => {
      callCount++;
      if (blockId === "page-1") {
        return [
          {
            id: "p1",
            type: "paragraph",
            has_children: false,
            paragraph: { rich_text: richText("No nested blocks here") },
          },
        ];
      }
      return [];
    };

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [pageRecord("page-1", "Simple Page")],
        listBlockChildren,
      },
    });

    expect(result.applied).toBe(true);
    // Only 1 call for the root page — no child fetches needed.
    expect(callCount).toBe(1);
  });

  it("safely serializes image blocks without throwing", async () => {
    const targetDir = await makeTempDir();

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [pageRecord("page-1", "Image Page")],
        listBlockChildren: async (blockId: string) => {
          if (blockId !== "page-1") return [];
          return [
            {
              id: "img-1",
              type: "image",
              image: {
                type: "external",
                external: { url: "https://example.com/photo.jpg" },
                caption: richText("A photo"),
              },
            } as NotionBlock,
          ];
        },
      },
    });

    expect(result.applied).toBe(true);
    expect(result.counts.error).toBe(0);
  });

  it("rejects javascript: URLs in image blocks instead of emitting them", async () => {
    const targetDir = await makeTempDir();
    const { readFile } = await import("node:fs/promises");

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [pageRecord("page-1", "Bad URL Page")],
        listBlockChildren: async (blockId: string) => {
          if (blockId !== "page-1") return [];
          return [
            {
              id: "img-2",
              type: "image",
              image: {
                type: "external",
                external: { url: "javascript:alert(1)" },
                caption: [],
              },
            } as NotionBlock,
          ];
        },
      },
    });

    // The image block is serializable (safe fallback), so no error.
    expect(result.applied).toBe(true);
    const filePath = path.join(targetDir, "bad-url-page.mdx");
    const content = await readFile(filePath, "utf8");
    // The javascript: URL must not appear as a Markdown link destination.
    expect(content).not.toContain("](javascript:");
    // A safe comment placeholder should appear instead.
    expect(content).toContain("<!-- image:");
  });
});

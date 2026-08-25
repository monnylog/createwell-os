import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatSyncResult,
  GENERATED_MARKER,
  normalizeSlug,
  syncPublishedContentToMdx,
  type NotionBlock,
} from "./notion/sync";
import type { CreateWellRecord } from "./notion/service";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "createwell-notion-sync-test-")
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

function pageRecord(
  id: string,
  name: string,
  overrides: Partial<CreateWellRecord> = {},
  properties: Record<string, unknown> = {}
): CreateWellRecord {
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
      ...properties,
    },
    ...overrides,
  };
}

function blockMap(entries: Record<string, NotionBlock[]>) {
  return async (blockId: string) => entries[blockId] ?? [];
}

describe("notion sync", () => {
  it("normalizes slugs safely", () => {
    expect(normalizeSlug(" Café / Launch ")).toBe("cafe-launch");
  });

  it("paginates content into generated MDX with nested block bodies and escaped frontmatter", async () => {
    const targetDir = await makeTempDir();
    const record = pageRecord(
      "page-1",
      'Field Note: "Hello"',
      {},
      {
        Slug: { type: "rich_text", rich_text: richText('Field Note: "Hello"') },
      }
    );

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [record],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "h1",
              type: "heading_1",
              heading_1: { rich_text: richText("Welcome") },
            },
            {
              id: "p1",
              type: "paragraph",
              paragraph: {
                rich_text: richText('Body with : colon and "quotes"'),
              },
            },
            {
              id: "li-1",
              type: "bulleted_list_item",
              has_children: true,
              bulleted_list_item: { rich_text: richText("Parent item") },
            },
          ],
          "li-1": [
            {
              id: "li-2",
              type: "bulleted_list_item",
              bulleted_list_item: { rich_text: richText("Child item") },
            },
          ],
        }),
      },
    });

    expect(result.applied).toBe(true);
    expect(result.counts.create).toBe(1);

    const filePath = path.join(targetDir, "field-note-hello.mdx");
    const content = await readFile(filePath, "utf8");
    expect(content).toContain('title: "Field Note: \\"Hello\\""');
    expect(content).toContain("notionSyncGenerated: true");
    expect(content).toContain(GENERATED_MARKER);
    expect(content).toContain("# Welcome");
    expect(content).toContain('Body with : colon and "quotes"');
    expect(content).toContain("- Parent item\n  - Child item");
  });

  it("reports duplicate and invalid normalized slugs as errors", async () => {
    const targetDir = await makeTempDir();

    const result = await syncPublishedContentToMdx({
      targetDir,
      dryRun: true,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord("page-1", "Hello / World"),
          pageRecord("page-2", "Hello World"),
          pageRecord("page-3", "!!!"),
        ],
        listBlockChildren: blockMap({}),
      },
    });

    expect(result.counts.error).toBe(3);
    expect(formatSyncResult(result)).toContain("Duplicate normalized slug");
    expect(formatSyncResult(result)).toContain(
      'Could not derive a safe slug from "!!!".'
    );
  });

  it("preserves manual files and fails instead of overwriting them", async () => {
    const targetDir = await makeTempDir();
    const manualPath = path.join(targetDir, "manual-post.mdx");
    await writeFile(
      manualPath,
      '---\ntitle: "Manual"\n---\n\nManual body\n',
      "utf8"
    );

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord(
            "page-1",
            "Manual Post",
            {},
            { Slug: { type: "rich_text", rich_text: richText("manual-post") } }
          ),
        ],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "p1",
              type: "paragraph",
              paragraph: { rich_text: richText("Generated body") },
            },
          ],
        }),
      },
    });

    expect(result.applied).toBe(false);
    expect(result.counts.error).toBe(1);
    expect(await readFile(manualPath, "utf8")).toContain("Manual body");
  });

  it("supports dry-run reporting without changing files", async () => {
    const targetDir = await makeTempDir();
    const filePath = path.join(targetDir, "dry-run-post.mdx");
    await writeFile(
      filePath,
      `---\ntitle: "Dry Run"\nslug: "dry-run-post"\nnotionPageId: "page-1"\nnotionPageUrl: "https://app.notion.com/page-1"\ncontentType: "Field Note"\npublishDate: "2026-08-25"\nnotionSyncGenerated: true\nnotionSyncPageId: "page-1"\n---\n${GENERATED_MARKER}\n\nOld body\n`,
      "utf8"
    );

    const result = await syncPublishedContentToMdx({
      targetDir,
      dryRun: true,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord("page-1", "Dry Run Post"),
        ],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "p1",
              type: "paragraph",
              paragraph: { rich_text: richText("New body") },
            },
          ],
        }),
      },
    });

    expect(result.applied).toBe(false);
    expect(result.counts.update).toBe(1);
    expect(await readFile(filePath, "utf8")).toContain("Old body");
  });

  it("fails clearly on unsupported blocks that could lose content", async () => {
    const targetDir = await makeTempDir();

    const result = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord("page-1", "Image Post"),
        ],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "img-1",
              type: "image",
              image: {
                type: "external",
                external: { url: "https://example.com/a.png" },
              },
            },
          ],
        }),
      },
    });

    expect(result.applied).toBe(false);
    expect(result.counts.error).toBe(1);
    expect(result.actions[0]?.message).toContain(
      'Unsupported Notion block type "image"'
    );
  });

  it("cleans up stale generated files on rename and unpublish while preserving manual MDX", async () => {
    const targetDir = await makeTempDir();

    await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord("page-1", "Old Name"),
          pageRecord("page-2", "Keep Me"),
        ],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "p1",
              type: "paragraph",
              paragraph: { rich_text: richText("Old body") },
            },
          ],
          "page-2": [
            {
              id: "p2",
              type: "paragraph",
              paragraph: { rich_text: richText("Keep body") },
            },
          ],
        }),
      },
    });

    await writeFile(
      path.join(targetDir, "manual-note.mdx"),
      "# Manual\n",
      "utf8"
    );

    const second = await syncPublishedContentToMdx({
      targetDir,
      dependencies: {
        listPublishedContentRecords: async () => [
          pageRecord("page-1", "New Name"),
        ],
        listBlockChildren: blockMap({
          "page-1": [
            {
              id: "p1",
              type: "paragraph",
              paragraph: { rich_text: richText("New body") },
            },
          ],
        }),
      },
    });

    expect(second.applied).toBe(true);
    expect(second.counts.create).toBe(1);
    expect(second.counts.delete).toBe(2);
    await expect(
      readFile(path.join(targetDir, "old-name.mdx"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(targetDir, "keep-me.mdx"), "utf8")
    ).rejects.toThrow();
    expect(
      await readFile(path.join(targetDir, "new-name.mdx"), "utf8")
    ).toContain("New body");
    expect(
      await readFile(path.join(targetDir, "manual-note.mdx"), "utf8")
    ).toContain("# Manual");
  });
});

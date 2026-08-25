import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { listAllBlockChildren } from "./client";
import { listPublishedContentRecords, type CreateWellRecord } from "./service";

export const GENERATED_MARKER = "<!-- createwell-notion-sync:generated -->";
const GENERATED_FIELD = "notionSyncGenerated";
const GENERATED_PAGE_FIELD = "notionSyncPageId";
type NotionRichText = {
  type?: string;
  plain_text?: string;
  text?: {
    content?: string;
    link?: { url?: string | null } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
  href?: string | null;
  equation?: { expression?: string };
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  archived?: boolean;
  [key: string]: unknown;
};

type NotionBlockTree = NotionBlock & {
  children: NotionBlockTree[];
};

type ExistingGeneratedFile = {
  absolutePath: string;
  relativePath: string;
  pageId: string | null;
  content: string;
};

type SyncRecord = {
  pageId: string;
  title: string;
  slug: string;
  notionUrl: string;
  contentType: string;
  publishDate: string;
  body: string;
  path: string;
  fileContent: string;
};

export type SyncActionKind = "create" | "update" | "delete" | "skip" | "error";

export type SyncAction = {
  kind: SyncActionKind;
  path?: string;
  pageId?: string;
  slug?: string;
  message: string;
};

export type SyncResult = {
  applied: boolean;
  dryRun: boolean;
  targetDir: string;
  actions: SyncAction[];
  counts: Record<SyncActionKind, number>;
};

type SyncDependencies = {
  listPublishedContentRecords: () => Promise<CreateWellRecord[]>;
  listBlockChildren: (blockId: string) => Promise<NotionBlock[]>;
};

type SyncOptions = {
  targetDir: string;
  dryRun?: boolean;
  dependencies?: Partial<SyncDependencies>;
};

const defaultDependencies: SyncDependencies = {
  listPublishedContentRecords,
  listBlockChildren: listAllBlockChildren,
};

function propertyValue(properties: Record<string, any>, name: string): string {
  const property = properties[name];
  if (!property) return "";
  if (property.type === "select" || property.type === "status")
    return property[property.type]?.name ?? "";
  if (property.type === "rich_text")
    return (
      property.rich_text?.map((item: any) => item.plain_text ?? "").join("") ??
      ""
    );
  if (property.type === "title")
    return (
      property.title?.map((item: any) => item.plain_text ?? "").join("") ?? ""
    );
  if (property.type === "date") return property.date?.start ?? "";
  if (property.type === "url") return property.url ?? "";
  return "";
}

function extractSlugCandidate(record: CreateWellRecord): string {
  const properties = record.properties as Record<string, any>;
  const explicitSlug = propertyValue(properties, "Slug").trim();
  if (explicitSlug) return explicitSlug;

  const externalUrl = propertyValue(properties, "URL").trim();
  if (externalUrl) {
    try {
      const pathname = new URL(externalUrl).pathname
        .split("/")
        .filter(Boolean)
        .at(-1);
      if (pathname) return pathname;
    } catch {
      return externalUrl;
    }
  }

  return record.name.trim() || record.id;
}

export function normalizeSlug(value: string): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    /(^|[\\/])\.\.?([\\/]|$)/.test(trimmed)
  ) {
    throw new Error(`Could not derive a safe slug from "${value}".`);
  }

  const normalized = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error(`Could not derive a safe slug from "${value}".`);
  }

  return normalized;
}

function serializeYamlScalar(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

export function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(
    ([key, value]) => `${key}: ${serializeYamlScalar(value)}`
  );
  return `---\n${lines.join("\n")}\n---`;
}

/** Allowlist safe URL schemes and encode unsafe characters in the destination. */
function sanitizeMarkdownUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    // Encode parentheses that would break the Markdown link syntax.
    return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
  } catch {
    return null;
  }
}

function escapeInlineMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    // Escape MDX/JSX control characters so generated output is safe.
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

function serializeRichText(richText: NotionRichText[] | undefined): string {
  return (richText ?? [])
    .map(fragment => {
      let text =
        fragment.type === "equation"
          ? (fragment.equation?.expression ?? fragment.plain_text ?? "")
          : (fragment.plain_text ?? fragment.text?.content ?? "");

      if (!text) return "";
      text = escapeInlineMarkdown(text);

      if (fragment.annotations?.code) text = `\`${text}\``;
      if (fragment.annotations?.bold) text = `**${text}**`;
      if (fragment.annotations?.italic) text = `*${text}*`;
      if (fragment.annotations?.strikethrough) text = `~~${text}~~`;
      if (fragment.annotations?.underline) text = `<u>${text}</u>`;

      const rawLink = fragment.text?.link?.url ?? fragment.href ?? null;
      if (rawLink) {
        const safeLink = sanitizeMarkdownUrl(rawLink);
        if (safeLink) text = `[${text}](${safeLink})`;
      }

      return text;
    })
    .join("");
}

function blockData<T extends Record<string, any>>(block: NotionBlockTree): T {
  return (block[block.type] as T | undefined) ?? ({} as T);
}

function serializeBlock(block: NotionBlockTree, depth = 0): string {
  const indent = "  ".repeat(depth);
  const children =
    block.children.length > 0 ? serializeBlocks(block.children, depth + 1) : "";
  const appendChildren = (content: string) =>
    [content, children].filter(Boolean).join("\n");

  switch (block.type) {
    case "paragraph": {
      const content = serializeRichText(
        blockData<{ rich_text?: NotionRichText[] }>(block).rich_text
      );
      return appendChildren(content ? `${indent}${content}` : "");
    }
    case "heading_1":
      return appendChildren(
        `# ${serializeRichText(blockData<{ rich_text?: NotionRichText[] }>(block).rich_text)}`
      );
    case "heading_2":
      return appendChildren(
        `## ${serializeRichText(blockData<{ rich_text?: NotionRichText[] }>(block).rich_text)}`
      );
    case "heading_3":
      return appendChildren(
        `### ${serializeRichText(blockData<{ rich_text?: NotionRichText[] }>(block).rich_text)}`
      );
    case "bulleted_list_item": {
      const content = serializeRichText(
        blockData<{ rich_text?: NotionRichText[] }>(block).rich_text
      );
      return appendChildren(`${indent}- ${content}`.trimEnd());
    }
    case "numbered_list_item": {
      const content = serializeRichText(
        blockData<{ rich_text?: NotionRichText[] }>(block).rich_text
      );
      return appendChildren(`${indent}1. ${content}`.trimEnd());
    }
    case "to_do": {
      const data = blockData<{
        rich_text?: NotionRichText[];
        checked?: boolean;
      }>(block);
      return appendChildren(
        `${indent}- [${data.checked ? "x" : " "}] ${serializeRichText(data.rich_text)}`.trimEnd()
      );
    }
    case "quote":
      return appendChildren(
        `${indent}> ${serializeRichText(blockData<{ rich_text?: NotionRichText[] }>(block).rich_text)}`.trimEnd()
      );
    case "callout":
      return appendChildren(
        `${indent}> ${serializeRichText(blockData<{ rich_text?: NotionRichText[] }>(block).rich_text)}`.trimEnd()
      );
    case "divider":
      return "---";
    case "code": {
      const data = blockData<{
        rich_text?: NotionRichText[];
        language?: string;
      }>(block);
      // Use raw plain text for code blocks — do not apply inline escaping or
      // annotation markup, which would corrupt code such as Windows paths or
      // literal backticks.
      const rawContent = (data.rich_text ?? [])
        .map(fragment => fragment.plain_text ?? fragment.text?.content ?? "")
        .join("");
      const language =
        data.language && data.language !== "plain text" ? data.language : "";
      // Choose a fence length that cannot occur in the content.
      const maxTicks = Math.max(2, ...Array.from(rawContent.matchAll(/`+/g), m => m[0].length));
      const fence = "`".repeat(maxTicks + 1);
      return `${indent}${fence}${language}\n${rawContent}\n${indent}${fence}`;
    }
    case "image": {
      const data = blockData<{
        type?: string;
        external?: { url?: string };
        file?: { url?: string };
        caption?: NotionRichText[];
      }>(block);
      const url = data.type === "external"
        ? (data.external?.url ?? "")
        : (data.file?.url ?? "");
      const caption = serializeRichText(data.caption);
      const safeUrl = sanitizeMarkdownUrl(url) ?? "";
      return safeUrl
        ? `${indent}![${caption}](${safeUrl})`
        : `${indent}<!-- image: ${escapeInlineMarkdown(caption || url || block.id)} -->`;
    }
    case "video":
    case "audio":
    case "file": {
      const data = blockData<{
        type?: string;
        external?: { url?: string };
        file?: { url?: string };
        caption?: NotionRichText[];
      }>(block);
      const url = data.type === "external"
        ? (data.external?.url ?? "")
        : (data.file?.url ?? "");
      const caption = serializeRichText(data.caption) || url;
      const safeUrl = sanitizeMarkdownUrl(url);
      return safeUrl
        ? `${indent}[${caption}](${safeUrl})`
        : `${indent}<!-- ${block.type}: ${escapeInlineMarkdown(caption || block.id)} -->`;
    }
    case "bookmark":
    case "embed": {
      const data = blockData<{ url?: string; caption?: NotionRichText[] }>(block);
      const url = data.url ?? "";
      const caption = serializeRichText(data.caption) || url;
      const safeUrl = sanitizeMarkdownUrl(url);
      return safeUrl
        ? `${indent}[${caption}](${safeUrl})`
        : `${indent}<!-- ${block.type}: ${escapeInlineMarkdown(caption || block.id)} -->`;
    }
    case "table": {
      // Render children (table_row blocks) if present, otherwise emit a comment.
      if (children) return children;
      return `${indent}<!-- table: (empty) -->`;
    }
    case "table_row": {
      const data = blockData<{ cells?: NotionRichText[][] }>(block);
      const cells = (data.cells ?? []).map(cell => serializeRichText(cell));
      return `${indent}| ${cells.join(" | ")} |`;
    }
    case "toggle": {
      const data = blockData<{ rich_text?: NotionRichText[] }>(block);
      const summary = serializeRichText(data.rich_text);
      const body = children ? `\n${children}\n` : "";
      return `${indent}<details><summary>${summary}</summary>${body}\n${indent}</details>`;
    }
    case "child_page": {
      const data = blockData<{ title?: string }>(block);
      const title = escapeInlineMarkdown(data.title ?? block.id);
      return `${indent}<!-- child_page: ${title} -->`;
    }
    case "synced_block": {
      // Render synced block children inline (original block) or emit comment
      // (pointer block—content lives in the original).
      const data = blockData<{ synced_from?: { block_id?: string } | null }>(block);
      if (data.synced_from?.block_id) {
        return `${indent}<!-- synced_block: content lives in block ${data.synced_from.block_id} -->`;
      }
      return children ? children : `${indent}<!-- synced_block: (empty) -->`;
    }
    default:
      throw new Error(
        `Unsupported Notion block type "${block.type}" on page ${block.id}.`
      );
  }
}

export function serializeBlocks(blocks: NotionBlockTree[], depth = 0): string {
  const content = blocks
    .filter(block => !block.archived)
    .map(block => serializeBlock(block, depth).trimEnd())
    .filter(Boolean)
    .join("\n\n");
  return content.replace(/^\n+|\n+$/g, "");
}

/** Limit the number of concurrent Notion block-children requests. */
const BLOCK_CONCURRENCY = 5;

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]!();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function fetchBlockTree(
  blockId: string,
  listChildren: SyncDependencies["listBlockChildren"],
  depth = 0,
  maxDepth = 25
): Promise<NotionBlockTree[]> {
  if (depth > maxDepth) {
    throw new Error(
      `Notion block nesting exceeded the supported depth limit (${maxDepth}).`
    );
  }

  const blocks = await listChildren(blockId);
  const withChildren = await runConcurrent(
    blocks.map(block => async () => ({
      ...block,
      children: block.has_children
        ? await fetchBlockTree(block.id, listChildren, depth + 1, maxDepth)
        : [],
    })),
    BLOCK_CONCURRENCY
  );
  return withChildren;
}

function fallbackBody(record: CreateWellRecord): string {
  return propertyValue(record.properties as Record<string, any>, "Copy").trim();
}

function buildFileContent(record: SyncRecord): string {
  const frontmatter = buildFrontmatter({
    title: record.title,
    slug: record.slug,
    notionPageId: record.pageId,
    notionPageUrl: record.notionUrl,
    contentType: record.contentType || null,
    publishDate: record.publishDate || null,
    [GENERATED_FIELD]: true,
    [GENERATED_PAGE_FIELD]: record.pageId,
  });

  return `${frontmatter}\n${GENERATED_MARKER}\n\n${record.body.trim()}\n`;
}

function parseGeneratedFile(
  content: string,
  absolutePath: string,
  relativePath: string
): ExistingGeneratedFile | null {
  if (
    !content.includes(GENERATED_MARKER) ||
    !new RegExp(`^${GENERATED_FIELD}: true$`, "m").test(content)
  ) {
    return null;
  }

  const pageIdMatch = content.match(
    new RegExp(`^${GENERATED_PAGE_FIELD}:\\s+"([^"]+)"$`, "m")
  );
  return {
    absolutePath,
    relativePath,
    pageId: pageIdMatch?.[1] ?? null,
    content,
  };
}

async function collectMdxFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async entry => {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectMdxFiles(absolutePath);
        return entry.isFile() && entry.name.endsWith(".mdx")
          ? [absolutePath]
          : [];
      })
    );
    return nested.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readExistingFiles(
  targetDir: string
): Promise<Map<string, ExistingGeneratedFile | "manual">> {
  const files = await collectMdxFiles(targetDir);
  const entries = await Promise.all(
    files.map(async absolutePath => {
      const content = await readFile(absolutePath, "utf8");
      const relativePath = path.relative(targetDir, absolutePath);
      return [
        relativePath,
        parseGeneratedFile(content, absolutePath, relativePath) ?? "manual",
      ] as const;
    })
  );
  return new Map(entries);
}

async function writeFileAtomic(filePath: string, content: string) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  await writeFile(temporaryPath, content, "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function createResult(
  targetDir: string,
  dryRun: boolean,
  actions: SyncAction[],
  applied: boolean
): SyncResult {
  const counts = {
    create: 0,
    update: 0,
    delete: 0,
    skip: 0,
    error: 0,
  } satisfies Record<SyncActionKind, number>;

  for (const action of actions) counts[action.kind] += 1;

  return {
    applied,
    dryRun,
    targetDir,
    actions,
    counts,
  };
}

export async function syncPublishedContentToMdx(
  options: SyncOptions
): Promise<SyncResult> {
  const targetDir = path.resolve(options.targetDir);
  const dryRun = options.dryRun ?? false;
  const dependencies = { ...defaultDependencies, ...options.dependencies };
  const actions: SyncAction[] = [];
  const desiredRecords = new Map<string, SyncRecord>();
  const desiredPageIds = new Set<string>();
  const normalizedToPage = new Map<string, string>();

  const records = await dependencies.listPublishedContentRecords();

  for (const record of records) {
    const slugCandidate = extractSlugCandidate(record);
    let slug: string;

    try {
      slug = normalizeSlug(slugCandidate);
    } catch (error) {
      actions.push({
        kind: "error",
        pageId: record.id,
        message: (error as Error).message,
      });
      continue;
    }

    const duplicatePageId = normalizedToPage.get(slug);
    if (duplicatePageId && duplicatePageId !== record.id) {
      actions.push({
        kind: "error",
        slug,
        pageId: record.id,
        message: `Duplicate normalized slug "${slug}" for Notion pages ${duplicatePageId} and ${record.id}.`,
      });
      continue;
    }
    normalizedToPage.set(slug, record.id);

    let body = "";
    try {
      const blocks = await fetchBlockTree(
        record.id,
        dependencies.listBlockChildren
      );
      body = serializeBlocks(blocks).trim();
    } catch (error) {
      actions.push({
        kind: "error",
        slug,
        pageId: record.id,
        message: (error as Error).message,
      });
      continue;
    }

    if (!body) body = fallbackBody(record);
    if (!body) {
      actions.push({
        kind: "error",
        slug,
        pageId: record.id,
        message: `Notion page ${record.id} has no serializable block content or Copy fallback.`,
      });
      continue;
    }

    const relativePath = `${slug}.mdx`;
    const absolutePath = path.resolve(targetDir, relativePath);
    if (path.relative(targetDir, absolutePath).startsWith("..")) {
      actions.push({
        kind: "error",
        slug,
        pageId: record.id,
        message: `Refusing to write outside the target directory for slug "${slug}".`,
      });
      continue;
    }

    const syncRecord: SyncRecord = {
      pageId: record.id,
      title: record.name,
      slug,
      notionUrl: record.url,
      contentType: propertyValue(
        record.properties as Record<string, any>,
        "Content Type"
      ),
      publishDate: propertyValue(
        record.properties as Record<string, any>,
        "Publish Date"
      ),
      body,
      path: relativePath,
      fileContent: "",
    };
    syncRecord.fileContent = buildFileContent(syncRecord);
    desiredRecords.set(relativePath, syncRecord);
    desiredPageIds.add(record.id);
  }

  const existingFiles = await readExistingFiles(targetDir);

  for (const [relativePath, desiredRecord] of Array.from(
    desiredRecords.entries()
  )) {
    const existing = existingFiles.get(relativePath);
    if (!existing) {
      actions.push({
        kind: "create",
        path: relativePath,
        pageId: desiredRecord.pageId,
        slug: desiredRecord.slug,
        message: `Create ${relativePath}.`,
      });
      continue;
    }

    if (existing === "manual") {
      actions.push({
        kind: "error",
        path: relativePath,
        pageId: desiredRecord.pageId,
        slug: desiredRecord.slug,
        message: `Refusing to overwrite manually managed file ${relativePath}.`,
      });
      continue;
    }

    if (existing.content === desiredRecord.fileContent) {
      actions.push({
        kind: "skip",
        path: relativePath,
        pageId: desiredRecord.pageId,
        slug: desiredRecord.slug,
        message: `No changes for ${relativePath}.`,
      });
      continue;
    }

    actions.push({
      kind: "update",
      path: relativePath,
      pageId: desiredRecord.pageId,
      slug: desiredRecord.slug,
      message: `Update ${relativePath}.`,
    });
  }

  for (const [relativePath, existing] of Array.from(existingFiles.entries())) {
    if (existing === "manual") continue;
    if (!existing.pageId) {
      actions.push({
        kind: "error",
        path: relativePath,
        message: `Generated file ${relativePath} is missing a page marker and cannot be cleaned safely.`,
      });
      continue;
    }

    const desired = desiredRecords.get(relativePath);
    // If the desired record for this path matches the stored page, it's up to date.
    if (desired?.pageId === existing.pageId) continue;
    // If the path already has a desired record for a different page, the create/update
    // action will replace the file — do not also schedule a delete for the same path.
    if (desired) continue;
    if (desiredPageIds.has(existing.pageId)) {
      // Page still published but mapped to a different slug — stale file.
      actions.push({
        kind: "delete",
        path: relativePath,
        pageId: existing.pageId,
        message: `Delete stale generated file ${relativePath}.`,
      });
      continue;
    }
    // Page was unpublished or removed.
    actions.push({
      kind: "delete",
      path: relativePath,
      pageId: existing.pageId,
      message: `Delete unpublished generated file ${relativePath}.`,
    });
  }

  if (actions.some(action => action.kind === "error")) {
    return createResult(targetDir, dryRun, actions, false);
  }

  if (dryRun) return createResult(targetDir, true, actions, false);

  await mkdir(targetDir, { recursive: true });

  for (const action of actions) {
    if (!action.path) continue;

    if (action.kind === "create" || action.kind === "update") {
      const record = desiredRecords.get(action.path);
      if (!record) continue;
      const filePath = path.join(targetDir, action.path);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFileAtomic(filePath, record.fileContent);
      continue;
    }

    if (action.kind === "delete") {
      await rm(path.join(targetDir, action.path), { force: true });
    }
  }

  return createResult(targetDir, false, actions, true);
}

export function formatSyncResult(result: SyncResult): string {
  const lines = [
    `Target directory: ${result.targetDir}`,
    result.dryRun ? "Mode: dry-run" : "Mode: apply",
  ];

  for (const action of result.actions) {
    const location = action.path ?? action.slug ?? action.pageId ?? "sync";
    lines.push(`${action.kind.toUpperCase()} ${location} - ${action.message}`);
  }

  lines.push(
    `Summary: create=${result.counts.create} update=${result.counts.update} delete=${result.counts.delete} skip=${result.counts.skip} error=${result.counts.error}`
  );

  return lines.join("\n");
}

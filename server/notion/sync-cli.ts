import path from "node:path";
import { formatSyncResult, syncPublishedContentToMdx } from "./sync";

const DEFAULT_TARGET_DIR = path.resolve(
  process.cwd(),
  process.env.NOTION_SYNC_OUTPUT_DIR ?? "docs/generated/notion-content"
);

function printHelp() {
  console.log(`Create Well Notion content sync

Usage:
  pnpm notion:sync [--dry-run] [--dir <path>]

Options:
  --dry-run   Report creates, updates, deletes, skips, and errors without writing files
  --dir       Override the target directory for generated MDX
  --help      Show this help text
`);
}

function parseArgs(argv: string[]) {
  let dryRun = false;
  let targetDir = DEFAULT_TARGET_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h")
      return { help: true, dryRun, targetDir };
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --dir.");
      targetDir = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, dryRun, targetDir };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await syncPublishedContentToMdx({
    targetDir: options.targetDir,
    dryRun: options.dryRun,
  });

  console.log(formatSyncResult(result));
  if (result.counts.error > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

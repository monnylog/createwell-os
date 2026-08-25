# Create Well OS: Notion production setup

Create Well OS uses Notion **server-side only**. The verified direction is **one-way from Notion into this repository and the app’s read models**. Do not add repo-to-Notion write-back here, do not expose the token to the browser, and do not commit credentials.

## 1. Scope the Notion connection

Create an internal Notion connection for Create Well OS with **read access only** to the five live v3 data sources and the published CONTENT pages whose block bodies will be exported:

- PEOPLE
- FLOWS
- MOVES
- MONEY
- CONTENT

The server requires `NOTION_API_TOKEN`. Store it only in server or GitHub Actions secrets. Never place it in browser code, a `VITE_` variable, or a Git commit.

## 2. Confirm the v3 contract

The current repository is aligned to the five-data-source v3 model documented in [`v3-domain-map.md`](./v3-domain-map.md). Production may override the built-in data-source identifiers with these server-only variables:

| Variable                        | Data source |
| ------------------------------- | ----------- |
| `NOTION_PEOPLE_DATA_SOURCE_ID`  | PEOPLE      |
| `NOTION_FLOWS_DATA_SOURCE_ID`   | FLOWS       |
| `NOTION_MOVES_DATA_SOURCE_ID`   | MOVES       |
| `NOTION_MONEY_DATA_SOURCE_ID`   | MONEY       |
| `NOTION_CONTENT_DATA_SOURCE_ID` | CONTENT     |

## 3. Verified public-read behavior

The existing app remains read-only and keeps the current public filters:

| Surface                   | Server-side filter                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/public/content` | CONTENT `Status = Published` and `Audience = Public`                                                      |
| `GET /api/public/flows`   | FLOWS `Public? = true`, `Status IN (Scheduled, Ready, Approved)`, `Type != Internal`, and `Date >= today` |
| `GET /api/team/*`         | authenticated read-only projections only                                                                  |

## 4. Generated MDX sync behavior

`pnpm notion:sync` exports published CONTENT pages into `docs/generated/notion-content` by default.

Verified safeguards:

- paginates through all CONTENT query results
- recursively fetches page block bodies before writing files
- serializes supported text-oriented blocks to Markdown/MDX
- quotes frontmatter values safely
- normalizes slugs to safe flat filenames and rejects collisions
- writes files atomically
- marks generated files and only cleans up marked stale files
- preserves manually managed `.mdx` files in the target tree
- supports `pnpm notion:sync:dry-run` reporting for creates, updates, deletes, skips, and errors
- exits nonzero when conversion is incomplete or unsafe

Current limitations:

- the sync is still **one-way**; it never writes back into Notion
- unsupported block types fail the sync rather than risk silently dropping content
- only generated files bearing the sync marker are eligible for automatic cleanup

## 5. Webhook and cache hygiene

If you use the Notion webhook endpoint at `/api/webhooks/notion`, store `NOTION_WEBHOOK_VERIFICATION_TOKEN` as a server-only secret. The endpoint verifies the `X-Notion-Signature` HMAC before invalidating cached public reads.

## 6. Workflow safeguards

The repository workflow for sync should:

- run with concurrency enabled so only one sync is active per ref
- apply a job timeout
- run `pnpm notion:sync:dry-run` before writing files
- run validation (`pnpm check` and targeted tests) before committing generated changes

## 7. Launch checklist

- Confirm the connection can read the five live v3 data sources.
- Confirm published CONTENT pages that should export are shared with the connection.
- Add `NOTION_API_TOKEN` and `NOTION_WEBHOOK_VERIFICATION_TOKEN` as server-only secrets where needed.
- Run `pnpm notion:sync:dry-run` and verify the reported creates, updates, deletes, skips, and errors.
- Run `pnpm notion:sync` only after the dry-run is clean.

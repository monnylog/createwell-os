# AGENTS.md

Operating instructions for any coding agent working in this repository. Read this before writing code, prose, or database records.

## How to read this repo

`template.json` is the **original scaffold**, not current state. It contains stringified copies of the starter `schema.ts`, `db.ts`, and `routers.ts`. Do not treat it as truth — read `server/` and `client/` directly. An earlier version of this file described the scaffold as if it were the live app and was wrong about several things.

Note on tooling: the GitHub connector's `get_file_contents` returns a success message without a body. `search_code` match fragments *do* return real file content. Use search.

## What this repo is

Create Well Collective's internal operating system — a TypeScript full-stack app with tRPC end to end, backed by Notion.

| Area | What's there |
| --- | --- |
| `client/` | React 19 + Vite 7, shadcn/ui over Radix, Tailwind 4, wouter routing |
| `server/_core/` | Express entry (`index.ts`), tRPC setup (`trpc.ts`), cookies, env, systemRouter |
| `server/notion/` | The Notion integration layer. See below — this is the heart of the app |
| `server/routers.ts` | tRPC v11 `appRouter`. Feature routers register here |
| `shared/` | Types and constants crossing the client/server boundary |
| `drizzle/` | Drizzle ORM (MySQL) schema and migrations |
| `docs/` | Operating documentation, mirrored from Notion |
| `patches/` | pnpm patches — `wouter@3.7.1` is patched |

Data fetching is **TanStack Query v5** through tRPC with `superjson`. Validation is **zod 4**.

## Commands

Verified against `package.json`.

| Command | What it runs |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | `NODE_ENV=development tsx watch server/_core/index.ts` |
| `pnpm build` | `vite build` then esbuild-bundles the server to `dist/` |
| `pnpm start` | `NODE_ENV=production node dist/index.js` |
| `pnpm check` | `tsc --noEmit` |
| `pnpm format` | `prettier --write .` |
| `pnpm test` | `vitest run` |
| `pnpm db:push` | `drizzle-kit generate && drizzle-kit migrate` |

There is **no lint script**. The gate is `pnpm check` plus `pnpm format`.

## Notion integration — read before adding features

Notion is the system of record. `server/notion/` already implements the full path.

| File | Responsibility |
| --- | --- |
| `client.ts` | Notion REST client. Base `https://api.notion.com/v1`, API version `2025-09-03`. Exports `createPage`, `queryDataSource`, `notionPageToRecord`, `notionProperty` |
| `config.ts` | Data source IDs and `assertNotionConfiguration` |
| `schemas.ts` | Zod input schemas, e.g. `topicWellInputSchema` (name 3–120 chars, drop 20–5000 chars, `anonymous` defaults true, `consentToShare` defaults false) |
| `service.ts` | Domain operations composing client + config |
| `cache.ts` | In-memory public cache, 60s TTL (`readPublicCache`) |
| `security.ts` | Idempotency replay returning `fresh` / `replay` / `conflict` |

`server/routers.ts` already imports `readPublicCache` and exposes `team.profile` behind `protectedProcedure`. Three procedure types exist in `server/_core/trpc.ts`: `publicProcedure`, `protectedProcedure`, `adminProcedure`.

## Database notes

- Drizzle targets **MySQL** (`drizzle-orm/mysql2`, `mysqlTable`). Never write Postgres-flavored schema.
- `DATABASE_URL` is required or `drizzle.config.ts` throws.
- `server/db.ts` creates the client lazily and degrades gracefully without a DB so local tooling runs. Preserve that.
- Auth is Manus OAuth keyed on `openId`; a user matching `ENV.ownerOpenId` is auto-granted `admin`.
- **Unverified:** the live contents of `drizzle/schema.ts` were not readable. Read it before assuming which tables exist.

## Open question — needs a human

`server/notion/config.ts` hardcodes six data source UUIDs as `??` fallbacks when env vars are absent: `people`, `offers`, `events`, `tasks`, `content`, `topicWell`.

None of them match the databases currently in active use — Depanty (`b7fdf4d6…`) and When the Water Is Ready to Rise (`1529b10e…`) do not appear. Either the app targets a different part of the workspace, or those fallbacks are stale. **A wrong ID in a `??` fallback fails silently in production.** Someone should confirm.

## The vocabulary

This project uses specific internal language. Using it incorrectly produces output that reads as nonsense to the team.

- **The Well** — a five-level model that fills from the bottom up. **Source** is the lowest level. If Source is not flowing, a commitment at a higher level borrows against something that does not exist.
- **Cohoe** — the monthly planning session. See `docs/minimum-viable-month.md` for what happens when it is missed.
- **Depanty** — the post-event reflection record: what landed, what the water taught us, what needs tending, what returns to Source, next gentle move.
- **Surprise-ment** — an unplanned opportunity arriving without warning. Runs through `docs/surprise-ment-filter.md`.
- **Flow Motion** — the database of active currents.
- **Water state** — `Clear` / `Moving` / `Rough` / `Needs rest`. An honest signal, never an aspirational one.
- **Shift lower in the well** — a real decision outcome. The idea is sound but the proposed cadence exceeds what the well can supply. Not a rejection.
- **flowing > forcing** — the governing principle. An agent may prepare the water. It never decides when the water rises.

## Rules for agents

1. **Never invent a number.** Percentages, revenue splits, thresholds, and prices are human decisions. Write `TBD`.
2. **Never tick a consent checkbox.** Fields like "2 of 3 feel a yes" represent people agreeing. Leave them unchecked.
3. **Never set a state more optimistic than the evidence.** An honest `Rough` beats a hopeful `Clear`.
4. **Notion is canonical for `docs/`.** Files there are version-controlled mirrors and say so at the top.
5. **Read the schema before writing to a Notion database.** Property names are case-sensitive; select options are fixed.
6. **Do not mirror Notion databases into Drizzle.** Notion is the system of record. A parallel SQL copy creates a second source of truth that will drift. Extend `server/notion/` instead.
7. **Route Notion writes through `service.ts`** and respect the idempotency helper in `security.ts`. Do not call the Notion API directly from a router.
8. **Read through `cache.ts`** where a 60s TTL is acceptable rather than hitting Notion per request.
9. **All API routes must live under `/api/`.** The gateway routes on that prefix.
10. **Prefer one commit over several** for related files.
11. **Name what drops, not just what continues.** A plan that only lists survivors leaves everything feeling equally urgent.
12. **Verify before documenting.** If a file cannot be read, mark it unverified rather than guessing. This file previously claimed `drizzle/schema.ts` held a single `users` table and omitted `server/notion/` entirely — both errors came from trusting `template.json` instead of reading the live code.

## Voice

Plain language. Short sentences. Active voice. No filler enthusiasm.

A clean no beats a vague maybe — in copy, in commit messages, and in conversation with the team.

## Related docs

- `docs/surprise-ment-filter.md` — how unplanned opportunities get decided
- `docs/sponsor-transparency.md` — payment model and ledger format
- `docs/minimum-viable-month.md` — fallback when the Cohoe is missed
- `docs/pre-departure-checklist.md` — handoff template for travel
- `docs/diagrams/how-we-flow.svg` — the visual model

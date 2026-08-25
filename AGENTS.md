# AGENTS.md

Operating instructions for any coding agent working in this repository. Read this before writing code, prose, or database records.

## How to read this repo

`template.json` is the **original scaffold**, not current state. It contains stringified copies of a starter `schema.ts`, `db.ts`, and `routers.ts` that no longer resemble the live code. Read `server/` and `client/` directly.

Tooling note: the GitHub connector's `get_file_contents` returns a success message without a body. `search_code` match fragments do return real content, but only index the default branch.

## What this repo is

Create Well Collective's internal operating system — a TypeScript full-stack app with tRPC end to end, backed by Notion.

| Area                | What's there                                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| `client/`           | React 19 + Vite 7, shadcn/ui over Radix, Tailwind 4, wouter routing            |
| `server/_core/`     | Express entry (`index.ts`), tRPC setup (`trpc.ts`), cookies, env, systemRouter |
| `server/notion/`    | The Notion integration layer. This is the heart of the app                     |
| `server/routers.ts` | tRPC v11 `appRouter`                                                           |
| `shared/`           | Types and constants crossing the client/server boundary                        |
| `drizzle/`          | Drizzle ORM (MySQL). Auth/user storage only — not domain data                  |
| `docs/`             | Operating documentation, mirrored from Notion                                  |
| `patches/`          | pnpm patches — `wouter@3.7.1` is patched                                       |

Data fetching is **TanStack Query v5** through tRPC with `superjson`. Validation is **zod 4**.

## Commands

Verified against `package.json`.

| Command        | What it runs                                            |
| -------------- | ------------------------------------------------------- |
| `pnpm install` | Install dependencies                                    |
| `pnpm dev`     | `NODE_ENV=development tsx watch server/_core/index.ts`  |
| `pnpm build`   | `vite build` then esbuild-bundles the server to `dist/` |
| `pnpm start`   | `NODE_ENV=production node dist/index.js`                |
| `pnpm check`   | `tsc --noEmit`                                          |
| `pnpm format`  | `prettier --write .`                                    |
| `pnpm test`    | `vitest run`                                            |
| `pnpm db:push` | `drizzle-kit generate && drizzle-kit migrate`           |

There is **no lint script**. The gate is `pnpm check` plus `pnpm format`.

Do not paste `# comments` onto the same line as a command — zsh treats them as arguments.

### tsconfig

`tsconfig.json` deliberately sets **no `target`**. With `"lib": ["esnext", "dom", "dom.iterable"]` and `"moduleResolution": "bundler"`, `tsc --noEmit` passes clean, including iterator spreads. Do not add a `target` to "fix" an error without confirming the error is real first.

## The v3 architecture

v3 is a **read model**. The surface is deliberately small.

### Router surface — complete

| Route                               | Procedure            |
| ----------------------------------- | -------------------- |
| `createWell.public.content`         | `publicProcedure`    |
| `createWell.public.flows`           | `publicProcedure`    |
| `createWell.team.profile`           | `protectedProcedure` |
| `createWell.team.programCalendar`   | `protectedProcedure` |
| `createWell.team.editorialPipeline` | `protectedProcedure` |
| `createWell.team.moves.list`        | `protectedProcedure` |

There is **no admin router** and **no mutation** under `createWell`. Removed in v3: `public.offers`, `team.tasks`, `team.checkIns`, `admin.needs`, `admin.decisions`.

### Data sources — five

`server/notion/config.ts` defines exactly five, each overridable by env var:

| Key       | Env var                         |
| --------- | ------------------------------- |
| `people`  | `NOTION_PEOPLE_DATA_SOURCE_ID`  |
| `flows`   | `NOTION_FLOWS_DATA_SOURCE_ID`   |
| `moves`   | `NOTION_MOVES_DATA_SOURCE_ID`   |
| `money`   | `NOTION_MONEY_DATA_SOURCE_ID`   |
| `content` | `NOTION_CONTENT_DATA_SOURCE_ID` |

`events` became `flows`. `tasks` became `moves`. Offers retired — the seven Well layers are now the `FLOWS.Type` select. Workshop Sessions, Book Club Sessions, Topic Well, Check-ins, Needs, Decisions, and Partner Organizations were all retired. **Do not reintroduce them.**

### PRIVATE_ONLY_KEYS

```
export const PRIVATE_ONLY_KEYS = ["people", "moves", "money"] as const;
```

These have **no public projection, ever**. Not filtered — absent. `assertNotionConfiguration()` also throws if any data source id is empty.

### The Notion layer

| File                | Responsibility                                                      |
| ------------------- | ------------------------------------------------------------------- |
| `client.ts`         | REST client. Base `https://api.notion.com/v1`, version `2025-09-03` |
| `config.ts`         | Data source ids, `PRIVATE_ONLY_KEYS`, `assertNotionConfiguration`   |
| `schemas.ts`        | Zod input schemas                                                   |
| `service.ts`        | Domain operations composing client + config                         |
| `v3-read-models.ts` | Public and team projections. The largest file here                  |
| `v3-guards.ts`      | Deny-list guards that throw rather than leak                        |
| `cache.ts`          | Public cache, 60s TTL (`readPublicCache`)                           |
| `security.ts`       | Idempotency replay: `fresh` / `replay` / `conflict`                 |

## The test suites that hold the line

**`server/notion.v3.privacy.test.ts` — 38 tests.** Read it before touching any public surface. It covers: the public FLOWS gate (actionable status, dated today or later, never Internal), `FLOWS.Phase` being internal-only, the marketing-overdue alarm, the public CONTENT gate (Published _and_ Public), MONEY never being publicly queryable, MOVES being scoped to the session person, stale-beats-wrong cache labelling, and non-empty deny-lists.

**`server/createwell.access.test.ts` — 13 tests.** Asserts anonymous callers get `UNAUTHORIZED` on every team route, public routes need no auth, and the v3 removals stay removed. If this fails with `NOT_FOUND`, a route was renamed or deleted — fix the router or the test deliberately, never by re-adding a retired route.

**`server/notion.secret.test.ts`** requires a live `NOTION_API_TOKEN`. It failing on a 401 is a credential problem, not a code problem.

## Database notes

- Drizzle targets **MySQL** (`drizzle-orm/mysql2`, `mysqlTable`). Never write Postgres-flavored schema.
- `DATABASE_URL` is required or `drizzle.config.ts` throws.
- `server/db.ts` creates the client lazily and degrades gracefully without a DB. Preserve that.
- Auth is Manus OAuth keyed on `openId`; a user matching `ENV.ownerOpenId` is auto-granted `admin`.
- Drizzle holds **auth/user data only**. Domain data lives in Notion.

## The vocabulary

- **The Well** — a model that fills from the bottom up. **Source** is the lowest level. If Source is not flowing, a commitment at a higher level borrows against something that does not exist.
- **Cohoe** — the monthly planning session. See `docs/minimum-viable-month.md` for what happens when it is missed.
- **Depanty** — the post-event reflection record: what landed, what the water taught us, what needs tending, what returns to Source, next gentle move.
- **Surprise-ment** — an unplanned opportunity. Runs through `docs/surprise-ment-filter.md`.
- **Flow** — a program or event. `FLOWS.Type` carries the Well layer; `FLOWS.Phase` is internal and never public.
- **Move** — a unit of work, owned by one person. Statuses include Now, Next, Done, Dropped.
- **Water state** — `Clear` / `Moving` / `Rough` / `Needs rest`. Honest, never aspirational.
- **Shift lower in the well** — a real decision outcome. The idea is sound but the cadence exceeds what the well can supply. Not a rejection.
- **flowing > forcing** — the governing principle. An agent may prepare the water. It never decides when the water rises.

## Rules for agents

1. **Never invent a number.** Percentages, splits, thresholds, prices are human decisions. Write `TBD`.
2. **Never tick a consent checkbox.** Fields like "2 of 3 feel a yes" represent people agreeing.
3. **Never set a state more optimistic than the evidence.** An honest `Rough` beats a hopeful `Clear`.
4. **Never project a PRIVATE_ONLY source publicly.** `people`, `moves`, and `money` have no public surface.
5. **Never add a mutation to the v3 surface** without an explicit decision. v3 is read-only by design.
6. **Stale beats wrong.** Serve from cache and mark it stale with its last good time. Never report a fresh sync you do not have.
7. **Do not mirror Notion into Drizzle.** Notion is the system of record; a SQL copy will drift.
8. **Route Notion writes through `service.ts`** and respect the idempotency helper in `security.ts`.
9. **Read through `cache.ts`** where a 60s TTL is acceptable.
10. **All API routes live under `/api/`.** The gateway routes on that prefix.
11. **Read the schema before writing to a Notion database.** Property names are case-sensitive; select options are fixed.
12. **Notion is canonical for `docs/`.** Files there are mirrors and say so at the top.
13. **Name what drops, not just what continues.** A plan listing only survivors leaves everything feeling equally urgent.
14. **Verify before documenting.** If a file cannot be read, mark it unverified rather than guessing. An earlier version of this file described the scaffold as the live app and was wrong about the database engine, the data sources, and the existence of `server/notion/`.

## Voice

Plain language. Short sentences. Active voice. No filler enthusiasm.

A clean no beats a vague maybe — in copy, in commit messages, and in conversation with the team.

## Related docs

- `docs/surprise-ment-filter.md` — how unplanned opportunities get decided
- `docs/sponsor-transparency.md` — payment model and ledger format
- `docs/minimum-viable-month.md` — fallback when the Cohoe is missed
- `docs/pre-departure-checklist.md` — handoff template for travel
- `docs/diagrams/how-we-flow.svg` — the visual model

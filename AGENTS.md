# AGENTS.md

Operating instructions for any coding agent working in this repository. Read this before writing code, prose, or database records.

## What this repo is

Create Well Collective's internal operating system — a TypeScript full-stack app with tRPC end to end.

| Area | What's there |
| --- | --- |
| `client/` | React 19 + Vite 7 front end, shadcn/ui over Radix primitives, Tailwind 4 |
| `server/` | Express 4 server. Entry point is `server/_core/index.ts` |
| `server/routers.ts` | tRPC v11 `appRouter`. Feature routers get registered here |
| `shared/` | Types and constants crossing the client/server boundary |
| `drizzle/schema.ts` | Drizzle ORM schema (MySQL). Currently only the `users` table |
| `docs/` | Operating documentation, mirrored from Notion |
| `patches/` | pnpm patches — `wouter@3.7.1` is patched. Check here before debugging odd dependency behavior |

Routing is **wouter**, not React Router. Data fetching is **TanStack Query v5** wired through tRPC with `superjson`. Validation is **zod 4**.

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

## Database notes

- Drizzle targets **MySQL** (`drizzle-orm/mysql2`, `mysqlTable`). Do not write Postgres-flavored schema.
- `DATABASE_URL` is required or `drizzle.config.ts` throws.
- `server/db.ts` creates the client lazily and degrades gracefully when the DB is absent, so local tooling runs without one. Preserve that behavior.
- Auth is Manus OAuth keyed on `openId`. A user matching `ENV.ownerOpenId` is auto-granted `admin`.

## The vocabulary

This project uses specific internal language. Using it incorrectly produces output that reads as nonsense to the team.

- **The Well** — a five-level model that fills from the bottom up. **Source** is the lowest level. If Source is not flowing, a commitment at a higher level borrows against something that does not exist.
- **Cohoe** — the monthly planning session. The efficiency model depends on it; see `docs/minimum-viable-month.md` for what happens when it is missed.
- **Depanty** — the post-event reflection record: what landed, what the water taught us, what needs tending, what returns to Source, next gentle move.
- **Surprise-ment** — an unplanned opportunity arriving without warning. Runs through `docs/surprise-ment-filter.md`.
- **Flow Motion** — the database of active currents.
- **Water state** — `Clear` / `Moving` / `Rough` / `Needs rest`. An honest signal, never an aspirational one.
- **Shift lower in the well** — a real decision outcome. It means the idea is sound but the proposed cadence is higher than the well can supply. It is not a rejection.
- **flowing > forcing** — the governing principle. An agent may prepare the water. It never decides when the water rises.

## Rules for agents

1. **Never invent a number.** Percentages, revenue splits, thresholds, and prices are human decisions. Write `TBD`.
2. **Never tick a consent checkbox.** Fields like "2 of 3 feel a yes" represent people agreeing. Leave them unchecked.
3. **Never set a state more optimistic than the evidence.** A `Rough` water state that is honest is more useful than a `Clear` one that is hopeful.
4. **Notion is canonical for `docs/`.** Files there are version-controlled mirrors. Every mirror says so at the top.
5. **Read the schema before writing to a Notion database.** Property names are case-sensitive and select options are fixed.
6. **Prefer one commit over several** for related files.
7. **Name what drops, not just what continues.** A plan that only lists what survives leaves everything feeling equally urgent.
8. **All API routes must live under `/api/`.** The gateway routes on that prefix; anything else will not resolve.
9. **Extend, don't replace.** `drizzle/schema.ts`, `server/db.ts`, and `server/routers.ts` each carry `TODO` markers showing exactly where new tables, queries, and feature routers belong.
10. **Verify before documenting.** If you cannot read a file, say so and mark it unverified rather than guessing. This section was wrong about the database engine until the code was actually read.

## Voice

Plain language. Short sentences. Active voice. No filler enthusiasm.

A clean no beats a vague maybe — in copy, in commit messages, and in conversation with the team.

## Related docs

- `docs/surprise-ment-filter.md` — how unplanned opportunities get decided
- `docs/sponsor-transparency.md` — payment model and ledger format
- `docs/minimum-viable-month.md` — fallback when the Cohoe is missed
- `docs/pre-departure-checklist.md` — handoff template for travel
- `docs/diagrams/how-we-flow.svg` — the visual model

# AGENTS.md

Operating instructions for any coding agent working in this repository. Read this before writing code, prose, or database records.

## What this repo is

Create Well Collective's internal operating system — a TypeScript full-stack app.

| Area | What's there |
| --- | --- |
| `client/` | Vite + React front end, shadcn/ui (see `components.json`) |
| `server/` | Node server |
| `shared/` | Types and logic crossing the client/server boundary |
| `drizzle/`, `drizzle.config.ts` | Drizzle ORM schema and migrations |
| `docs/` | Operating documentation, mirrored from Notion |
| `patches/` | pnpm patches — check here before debugging odd dependency behavior |

Tooling: pnpm (see `pnpm-lock.yaml`), Vitest (`vitest.config.ts`), Prettier (`.prettierrc`), TypeScript (`tsconfig.json`).

## Commands

**UNVERIFIED — fill these in.** Read `package.json` and replace this section with the real script names. Do not guess and do not run invented commands.

```
install: pnpm install
dev:     TODO
build:   TODO
test:    TODO
migrate: TODO   # Drizzle
```

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

## Voice

Plain language. Short sentences. Active voice. No filler enthusiasm.

A clean no beats a vague maybe — in copy, in commit messages, and in conversation with the team.

## Related docs

- `docs/surprise-ment-filter.md` — how unplanned opportunities get decided
- `docs/sponsor-transparency.md` — payment model and ledger format
- `docs/minimum-viable-month.md` — fallback when the Cohoe is missed
- `docs/pre-departure-checklist.md` — handoff template for travel
- `docs/diagrams/how-we-flow.svg` — the visual model

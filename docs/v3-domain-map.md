# Create Well OS v3 — Domain Map

Status: read-only alignment branch. Nothing in this document authorizes a write path.

## The one rule

If a fact can be edited in two places, one of those places is wrong and you will not know which. Every fact has exactly one write surface. Notion writes. The repo remembers. The site reads. Nothing writes backward.

## Live data sources (confirmed 2026-08-24)

| Database | Data source ID | Owns |
|---|---|---|
| PEOPLE | `b97bcbdf-2b1b-488d-9d07-4012b031732e` | One row per human, forever. Consent, invitation, relationship owner. |
| FLOWS | `c1677843-dd13-4e37-9f80-e960b26847dc` | One row per dated thing. Seven Well layers plus Internal. |
| MOVES | `5597e583-f7df-4f6c-90b0-296a26c57454` | Tasks. One owner, one due date, one parent Flow. |
| MONEY | `55832c19-38fa-44cb-b4c2-0174b4c5b207` | Both directions of cash. Private. |
| CONTENT | `cd410d33-8052-4897-8226-3a3ca84ea8bc` | Publishable copy and asset links. |

The budget is fixed: five databases, three automations, six views. Every new table needs a deletion.

## Vocabulary retirement

| Legacy app concept | v3 destination | Note |
|---|---|---|
| `offers` | `FLOWS.Type` select | The seven Well layers are a Select field, not a database. A seven-row lookup table that never changes is a Select. |
| `events` | `FLOWS` | One row per dated thing, whatever its layer. |
| `tasks` | `MOVES` | `Now` or `Next` IS the priority. `Dropped` is a real outcome. |
| `topicWell` | paused | No separate database. A drop becomes a CONTENT draft, a FLOWS `Idea`, or a page body. |
| `checkIns` | paused | No separate database until the five-database home and permission model are named. |
| `needs` | paused | Stays private and page-based. |
| `decisions` | paused | Stays private and page-based. |
| `people` | `PEOPLE` | Unchanged. Private by default. |
| `content` | `CONTENT` | Unchanged source; property assumptions replaced. |

## Route status matrix

| Route | Source | Status | Filter |
|---|---|---|---|
| `GET /api/public/content` | CONTENT | keep, remap properties | `Status = Published AND Audience = Public` |
| `GET /api/public/flows` | FLOWS | remap from `events` | `Public? = true AND Status IN (Scheduled, Ready, Approved) AND Date >= today` |
| `GET /api/team/this-week` | FLOWS + MOVES | new projection | This-week Flow dates; signed-in person's `Now`/`Next` Moves only |
| `GET /api/public/offers` | — | delete | Offers is retired. |
| `POST /api/topic-well` | — | pause | Destination undecided. |
| `GET/POST /api/team/check-ins` | — | pause | No database home yet. |
| `needs`, `decisions` | — | pause | Private until permissions are proven. |
| any MONEY route | MONEY | never public | No public route exists by design. |

## Status vocabularies (authoritative)

- `FLOWS.Type`: Podyap, Open Studio, Book Club, Workshop, Pop-Up, Surprise-ment, Geyser, Internal
- `FLOWS.Status`: Idea, Scheduled, Ready, Approved, Happened, Wrapped, Cancelled
- `MOVES.Status`: Now, Next, Done, Dropped
- `MOVES.Type`: Prep, Day-Of, Follow-Up, Admin, Content
- `MONEY.Stage`: Possible, Committed, Invoiced, Received, Paid
- `MONEY.Direction`: In, Out
- `CONTENT.Status`: Draft, Ready, Published, Archived
- `CONTENT.Audience`: Public, Team
- `CONTENT.Content Type`: Editorial Note, Field Note, Episode Copy, Event Copy, Resource, Asset Link, Promo
- `PEOPLE.Well Level`: Arrive, Exhale, Come Home, Return, Deepen, Paused, Do Not Contact

## Two decisions encoded in code

**Public Flows use a compound gate.** `Public?` alone is insufficient — a Flow can be public and still be an `Idea` or already `Cancelled`. `Happened` and `Wrapped` are excluded from the public surface even when recent.

**`Final?` is scoped, not global.** It gates `Asset Link` rows and asset rendering only. Applying it to all CONTENT would silently hide published Editorial Notes and Episode Copy that never needed an asset checkbox.

## Consent is a gate, not a note

Blank `Consent Captured` blocks all outbound. Enforced in the `Next Right Invitation` view filter, not in someone's memory. No public read path may expose PEOPLE.

## Stop point for this branch

Stop after the privacy tests pass against fixtures. Do not add: an edit button, a public form, a Drive sync, a Supabase table, a Calendar path, a sixth data source, or dashboard visuals.

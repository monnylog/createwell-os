# Create Well Canonical Notion Schemas

This document is the implementation contract between Create Well OS and the Notion workspace. **Notion credentials are server-only.** Database identifiers may be configured on the server, but neither identifiers nor tokens are ever required by browser code.

## Topic Well

| Property         | Notion type       | Required | Allowed values or rule                                   | Purpose                                            |
| ---------------- | ----------------- | -------: | -------------------------------------------------------- | -------------------------------------------------- |
| Name             | Title             |      Yes | Short label derived from the drop                        | Human-readable record name                         |
| Status           | Select            |      Yes | Intake, Reviewing, Synthesis Candidate, Locked, Archived | Intake and editorial lifecycle                     |
| Drop             | Rich text         |      Yes | Community member’s full topic drop                       | Source material                                    |
| Anonymous        | Checkbox          |      Yes | Defaults to true for public submissions                  | Suppresses contributor attribution in shared views |
| Contributor      | Relation → People |       No | Team-authenticated submissions only                      | Private contributor link                           |
| Consent to Share | Checkbox          |      Yes | Explicit public-share consent                            | Limits public reuse                                |
| Synthesis        | Rich text         |       No | Team-generated synthesis                                 | Editorial distillation                             |
| Why              | Rich text         |       No | Why the topic matters now                                | Selection rationale                                |
| Week             | Date              |       No | Monday of the locked week                                | Programming rhythm                                 |
| Source           | Select            |      Yes | Public Form, Team, Workshop, Podcast, Event              | Capture context                                    |
| Created time     | Created time      |   System | Not editable                                             | Audit trail                                        |

## Check-ins

| Property         | Notion type       | Required | Allowed values or rule                                    | Purpose                                     |
| ---------------- | ----------------- | -------: | --------------------------------------------------------- | ------------------------------------------- |
| Name             | Title             |      Yes | Person name plus ISO week                                 | Human-readable check-in                     |
| Person           | Relation → People |      Yes | Exactly one person                                        | Authenticated team member link              |
| Week             | Date              |      Yes | Monday of the reporting week                              | Weekly rhythm                               |
| Mood             | Select            |      Yes | Grounded, Clear, Tender, Activated, Low, Energized, Mixed | Emotional signal without forced explanation |
| Absorption       | Select            |      Yes | Open, Steady, Full, Overfull, Recovering                  | Capacity signal                             |
| Body Status      | Select            |      Yes | Steady, Activated, Tender, Depleted, Restoring            | Somatic operating condition                 |
| Reflection       | Rich text         |       No | Freeform weekly reflection                                | Context and nuance                          |
| Follow-up Needed | Checkbox          |      Yes | Defaults to false                                         | Escalation cue                              |
| Share Level      | Select            |      Yes | Private, Facilitator, Team                                | Visibility boundary                         |
| Created time     | Created time      |   System | Not editable                                              | Audit trail                                 |

## Needs

| Property         | Notion type       | Required | Allowed values or rule                                                | Purpose                                 |
| ---------------- | ----------------- | -------: | --------------------------------------------------------------------- | --------------------------------------- |
| Name             | Title             |      Yes | Concise need label                                                    | Human-readable record name              |
| Person           | Relation → People |      Yes | Exactly one person                                                    | Person whose conditions are represented |
| Category         | Select            |      Yes | Communication, Time, Environment, Energy, Access, Role Clarity, Other | Makes operating conditions actionable   |
| Need             | Rich text         |      Yes | Clear statement of what supports the person                           | Primary need                            |
| Boundary         | Rich text         |       No | Observable limit or agreement                                         | Prevents vague commitments              |
| Status           | Select            |      Yes | Active, Discussing, Supported, Archived                               | Current state                           |
| Owner Action     | Rich text         |       No | Concrete support action and owner                                     | Follow-through without over-functioning |
| Review Date      | Date              |       No | Next intentional review                                               | Keeps conditions current                |
| Visibility       | Select            |      Yes | Admin Only, Person and Admin, Team Shared                             | Strict privacy boundary                 |
| Last edited time | Last edited time  |   System | Not editable                                                          | Audit trail                             |

## Decisions

| Property         | Notion type       | Required | Allowed values or rule                                                                | Purpose                       |
| ---------------- | ----------------- | -------: | ------------------------------------------------------------------------------------- | ----------------------------- |
| Name             | Title             |      Yes | Concise decision label                                                                | Human-readable record name    |
| Domain           | Select            |      Yes | Programming, Editorial, Operations, Finance, Partnerships, Technology, Community Care | Decision category             |
| Status           | Select            |      Yes | Proposed, Decided, Revisit, Archived                                                  | Decision lifecycle            |
| Decision         | Rich text         |      Yes | The actual call in clear language                                                     | Source of truth               |
| Rationale        | Rich text         |      Yes | Why this call was made                                                                | Preserves context             |
| Decider          | Relation → People |      Yes | One or more accountable people                                                        | Authority trail               |
| Decision Date    | Date              |      Yes | Date of the call                                                                      | Historical clarity            |
| Effective Date   | Date              |       No | When the decision starts applying                                                     | Operational timing            |
| Next Action      | Rich text         |       No | First concrete follow-through                                                         | Converts decision into action |
| Task             | Relation → Tasks  |       No | Linked implementation task                                                            | Execution traceability        |
| Visibility       | Select            |      Yes | Admin Only, Team Shared                                                               | Access boundary               |
| Last edited time | Last edited time  |   System | Not editable                                                                          | Audit trail                   |

## Server contract

The public API may read only approved Content, active Offers, approved upcoming Events, and public-safe Topic Well submissions. Needs, Decisions, Check-ins, people relations, raw topic drops, and all internal notes are private. The server enforces this boundary before every Notion request.

# v3 Process Architecture Read-Model Contract

> Notion is canonical. This document defines how the process architecture may be projected into v3 without creating a second source of truth or expanding the public surface.

## Source of truth

The FLOWS and PEOPLE schemas were aligned to the process architecture on 2026-08-24.

- FLOWS gained `Offering Arc`, `Readiness Outcome`, and `Thank-you Due`.
- PEOPLE renamed `Well Level` to `Pathway Stage` and gained `Last Return Signal`.

## FLOWS inputs

### Existing public-safe candidates

- `Name`
- `Type`
- `Date`
- `Venue`
- `Status`
- `Public?`

### Existing team-only inputs

- `Phase`
- `Flow Keeper`
- `Support`
- `Capacity`
- `Media Cutoff`
- `Drive Folder`
- `Moves`
- `Retro`
- `Notes`
- `Attended`
- `Money`

### New team-only inputs

- `Offering Arc` — Sense, Name, Design, Practice, Integrate, Sustain
- `Readiness Outcome` — Not yet, Start here, Ready for depth
- `Thank-you Due` — the 24–48-hour return-rhythm date

## PEOPLE inputs

PEOPLE is private-only. Its fields may be read only by protected, authorized team projections.

- `Pathway Stage`
- `Last Return Signal`
- `Next Invitation`
- `Consent` / `Consent Captured`
- `Flows Attended`
- `Owner`
- `Bench Stage`
- `Follow-up Moves`

Never expose PEOPLE data publicly, including name, email, phone, handle, notes, consent, owner, Money, or Money Owned.

## Public contract

`createWell.public.flows` stays limited to its existing approved projection.

The new FLOWS properties are **not public**. The existing gates remain:

- `Public?` is true
- Status is actionable
- Date is today or later
- Type is not `Internal`

`Phase` and every relation remain denied. The public model never selects them.

## Team contracts

### Program calendar

The protected team calendar may expose:

- Name
- Type
- Date
- Venue
- Status
- Phase
- Offering Arc
- Readiness Outcome
- Thank-you Due
- Capacity
- Flow Keeper
- Support

It must not return Money, Notes, Retro, Drive Folder, Attended, Guests, or contact information.

### Return Rhythm

Return Rhythm is a future **protected-only** projection. If implemented, it may expose only:

- Pathway Stage
- Last Return Signal
- Next Invitation
- A consent-present boolean
- Attendance count
- Bench Stage
- Owner display name only when already authorized for the viewer

It must never return person name, email, phone, handle, notes, raw consent options, Money, or Money Owned.

Do not add the route until its authorization test and field mapper exist.

## Required tests

Before code implementation:

- New FLOWS fields never appear in the public mapper or public query
- Team Flow mapper includes only the permitted new fields
- PRIVATE_ONLY PEOPLE has no public query path
- Return Rhythm refuses unauthenticated callers
- `Do Not Contact` and blank `Consent Captured` are excluded from actionable outreach
- A stale cache payload includes `lastGoodAt`, never a false fresh timestamp

## Definition of done

A local coding agent reads the current v3 branch files first, then adds the permitted Flow fields to the existing team projection and its tests. It runs `pnpm check` and `pnpm test`.

Do not write Notion records or add a public route. Do not mirror Notion data into Drizzle.

# Create Well OS: Notion Production Setup

Create Well uses Notion only through the server. **Never place the Notion token in browser code, a `VITE_` variable, a client-side config file, or a Git commit.**

## 1. Create and scope the Notion connection

Create an internal Notion connection for Create Well OS. Enable read, insert, and update access. Share only the nine Create Well databases and the required parent pages with that connection. Do not give it workspace-wide access.

The server requires `NOTION_API_TOKEN`. This value is stored in the project’s secret settings and is intentionally absent from the repository.

## 2. Confirm the database contract

The canonical schemas for Topic Well, Check-ins, Needs, and Decisions are in [`notion-schemas.md`](./notion-schemas.md). The existing data-source identifiers are server defaults, but production may override them with these server-only variables:

| Variable | Database |
|---|---|
| `NOTION_PEOPLE_DATA_SOURCE_ID` | People |
| `NOTION_OFFERS_DATA_SOURCE_ID` | Offers |
| `NOTION_EVENTS_DATA_SOURCE_ID` | Events |
| `NOTION_TASKS_DATA_SOURCE_ID` | Tasks |
| `NOTION_CONTENT_DATA_SOURCE_ID` | Content |
| `NOTION_TOPIC_WELL_DATA_SOURCE_ID` | Topic Well |
| `NOTION_CHECK_INS_DATA_SOURCE_ID` | Check-ins |
| `NOTION_DECISIONS_DATA_SOURCE_ID` | Decisions |
| `NOTION_NEEDS_DATA_SOURCE_ID` | Needs |

## 3. Configure public content discipline

Only these records may reach public routes:

| Public endpoint | Server-side filter |
|---|---|
| `GET /api/public/content` | Content `Status = Published` and `Audience = Public` or `Community` |
| `GET /api/public/offers` | Offers whose status is not archived, inactive, or cancelled |
| `GET /api/public/events` | Future Events whose status is not draft, archived, or cancelled |

The public API serializes only safe display fields. It never passes raw Notion properties to the browser.

## 4. Activate the Topic Well safely

`POST /api/topic-well` validates every payload, permits eight submissions per IP address every fifteen minutes, and stores replay responses for 24 hours per idempotency key. A public submission creates a Topic Well record with the default **Intake** state. The browser should always create and send an `Idempotency-Key` header.

## 5. Configure the Notion webhook

Create a Notion webhook subscription directed at:

```text
https://YOUR-DOMAIN/api/webhooks/notion
```

Complete Notion’s verification flow, then store the resulting verification token in the server-only `NOTION_WEBHOOK_VERIFICATION_TOKEN` secret. The ingress endpoint verifies the `X-Notion-Signature` HMAC before invalidating the public cache. Subscribe only to Content and Events page/database updates required for public freshness.

## 6. Preserve private boundaries

`/api/team/*` requires a valid Manus OAuth session. `/api/admin/needs` and `/api/admin/decisions` require the authenticated local user role to equal `admin`. UI hiding is not security; these conditions are enforced inside the server routes and tRPC procedures.

## 7. Launch checklist

- Confirm that every team member who needs check-ins has a People record with a matching email or name.
- Confirm that current Offers, Events, and published Content have the expected status fields.
- Add the production domain to the Notion webhook subscription.
- Test a Topic Well form submission twice with the same idempotency key and verify that only one Notion record is created.
- Test a non-admin account against Needs and Decisions and confirm it receives a `403` response.

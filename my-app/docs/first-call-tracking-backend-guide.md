# First Call Timestamp: Backend Guide (New CRM)

## Goal

When Sales Executive makes the first call from **Complete Task -> Call button**, persist and expose that first-call timestamp so frontend can show it reliably everywhere.

Target display format in frontend:

- Date: `DD Month YYYY` (example: `24 April 2026`)
- Time: `h:mm:ss AM/PM` (example: `9:07:55 AM`)

---

## Why backend support is recommended

Frontend can infer first call from activity logs, but backend persistence is better because:

- works even if activity text changes
- stable across pages/reports/APIs
- easy to filter/report by first-call SLA

---

## Recommended backend changes

## 1) Persist first call on lead entity

Add nullable column/field on lead table/entity:

- `firstCallAt` (`timestamp` / `datetime`)

Behavior:

- on call activity event:
  - if `firstCallAt` is `null`, set to current timestamp
  - if already set, keep existing value

This ensures only first call is stored.

## 2) Activity endpoint contract

Current call logging endpoint:

- `POST /.../activity` with `activityType = CALL`

Update handler:

- wrap in transaction
- create activity row
- conditionally set `firstCallAt` once

## 3) Include firstCallAt in lead detail response

In lead detail APIs used by New CRM (`GET lead detail`, filter/list if needed), include:

- `firstCallAt`

Optional: also include in list DTO if needed for table chips/export.

## 4) Migration

Add SQL migration:

- add nullable `first_call_at` column
- no backfill required initially

Optional backfill:

- from earliest CALL activity per lead.

## 5) Validation/Tests

Add tests:

- First CALL sets `firstCallAt`
- Second CALL does not overwrite
- Non-CALL activity does not set field
- API response returns saved value

---

## Frontend contract expectation

Frontend expects either:

- `firstCallAt` on lead detail payload (preferred), OR
- CALL activities with stable `createdAt` and `activityType=CALL`.

If `firstCallAt` is available, frontend should prefer it over inference.


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

---

## New CRM Error Handling Update (User-Friendly Messages)

This note explains the recent fix for New CRM save errors where technical backend exceptions were shown to end users.

## Problem

Users were seeing technical messages like:

- `Cannot deserialize value of type java.lang.String from Object value`
- `HttpMessageNotReadableException`

These are backend/debug messages and are not understandable for most users.

## Root Cause

- Some requests sent `propertyDetails` in object format (`{...}`) while backend expected a string.
- Raw backend error text was passed directly to UI in some New CRM flows (Add Note / Save lead data).

## Backend changes completed

### 1) `Mlead.propertyDetails` made compatible with object or string input

File:

- `src/main/java/com/ProjectERP/HUB/HUB/proj/Pojoclasses/Mlead.java`

Change:

- Added `@JsonDeserialize(using = StringOrJsonValueDeserializer.class)` on `setPropertyDetails(...)`.
- Now backend accepts string/object/array values and stores normalized string JSON safely.

### 2) User-friendly API error payload

File:

- `src/main/java/com/ProjectERP/HUB/HUB/proj/Controlers/GlobalExceptionHandler.java`

Change:

- For `HttpMessageNotReadableException` and `DataIntegrityViolationException`, backend now returns:
  - `error`: safe user-friendly message
  - `userMessage`: same friendly message (preferred by frontend)
  - `debugMessage`: technical detail for logs/debugging

Example response:

```json
{
  "success": false,
  "type": "HttpMessageNotReadableException",
  "error": "Property details format is invalid. Please enter property details as plain text and try again.",
  "userMessage": "Property details format is invalid. Please enter property details as plain text and try again.",
  "debugMessage": "Cannot deserialize value of type ..."
}
```

## Frontend changes completed (New CRM)

File:

- `src/main/resources/static/lead-details.html`

Changes:

- Added helper: `getFriendlyApiErrorMessage(responseText, fallbackMessage)`
  - Reads JSON and prefers `userMessage`, then `error`, then `message`
  - Hides long/technical text and shows clean fallback
- Updated Add Note flows to use friendly message parsing:
  - lead data save failure
  - note activity save failure

## What users see now

Instead of technical backend errors, users now see clear messages like:

- `Unable to save lead details. Please check the values and try again.`
- `Property details format is invalid. Please enter property details as plain text and try again.`
- `Unable to save note activity. Please try again.`

## Frontend integration rule (recommended)

In all New CRM API error handling, use this priority:

1. `response.userMessage`
2. `response.error`
3. `response.message`
4. generic fallback (friendly)

Do not show `debugMessage` to end users.

## Deployment / verification checklist

- [ ] Deploy backend with `Mlead` + `GlobalExceptionHandler` updates.
- [ ] Ensure New CRM `lead-details.html` is updated in deployed build.
- [ ] Test Add Note save with valid payload (success path).
- [ ] Test invalid payload (`propertyDetails` as object) and confirm user-friendly message.
- [ ] Confirm no raw Jackson exception text appears in user modal/toast.


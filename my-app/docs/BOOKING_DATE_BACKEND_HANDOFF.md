# Booking Date — Backend Handoff

**Status:** Frontend ready; Hub must persist `bookingDate`  
**Audience:** Hub / Spring backend (`Project-ERP`)  
**Frontend repo:** `CrmInceneration/my-app`  
**Related:** [BOOKING_TOKEN_LISTING_TYPE_BACKEND_HANDOFF.md](./BOOKING_TOKEN_LISTING_TYPE_BACKEND_HANDOFF.md), `booking_token_record`, Booking Done submit

---

## 1. Summary

On **Booking Done** handoff, the user picks a **booking date** (calendar day, not timestamp). The CRM UI requires this field and sends it on submit. Hub must **validate, store, and return** it on `booking_token_record` (and list/detail APIs).

| UI | Behavior |
|----|----------|
| Booking Done modal | Section **Booking Date** above Payment Proof |
| Format sent | `YYYY-MM-DD` (local calendar day, IST-friendly display in UI) |
| Default | Today if user does not change |
| Validation (FE) | Required before **Confirm for Booking & Token** |

---

## 2. Database

### Table: `booking_token_record`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `booking_date` | `DATE` | NOT NULL (after migration) | Calendar date of booking (product), distinct from `submitted_at` |

**Optional index** (reporting / B&T date filters):

```sql
CREATE INDEX idx_booking_token_booking_date
  ON booking_token_record (booking_date DESC);
```

### Backfill

For existing rows without a date:

```sql
UPDATE booking_token_record
SET booking_date = DATE(submitted_at)
WHERE booking_date IS NULL AND submitted_at IS NOT NULL;

UPDATE booking_token_record
SET booking_date = CURRENT_DATE
WHERE booking_date IS NULL;
```

Then enforce `NOT NULL` if product requires it for all new rows.

---

## 3. API — Booking Done submit (create record)

### Frontend → Next.js BFF

```
POST /api/crm/booking-done/{leadType}/{leadId}
Content-Type: application/json
Authorization: Bearer {crm_token}
```

### Request body (add field)

Existing fields unchanged (`hubLeadId`, `quoteId`, `quoteVersionLabel`, `quoteAmount`, `tenPercentAmount`, `amountReceived`, `paymentKind`, `quoteVerifyUrl`). **Add:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `bookingDate` | string | **Yes** | `YYYY-MM-DD` only |

**Example:**

```json
{
  "hubLeadId": "uuid",
  "quoteId": "71015",
  "quoteVersionLabel": "Version 2",
  "quoteAmount": 1563797,
  "tenPercentAmount": 156380,
  "amountReceived": 156380,
  "paymentKind": "FULL_10%",
  "quoteVerifyUrl": "https://...",
  "bookingDate": "2026-09-05"
}
```

**Snake_case alias (optional):** accept `booking_date` same value.

### Hub validation

- Reject `400` if missing or blank.
- Reject `400` if not valid `YYYY-MM-DD`.
- Optional product rule: reject dates more than N days in the future (coordinate with product; FE does not enforce future limit today).

### BFF → Hub

Proxy body as-is (camelCase). Try existing candidates:

- `{BASE_URL}/api/crm/lead/{leadType}/{leadId}/booking-done`
- `{BASE_URL}/v1/leads/{leadType}/{leadId}/booking-done`

See `lib/booking-done-upstream.ts`.

### Success response

Include persisted date on the created record:

```json
{
  "id": "record-uuid",
  "leadType": "gleads",
  "leadId": 12345,
  "bookingDate": "2026-09-05",
  "submittedAt": "2026-09-05T10:30:00+05:30",
  "amountReceived": 156380,
  "paymentKind": "FULL_10%"
}
```

Also return `booking_date` in JSON if Hub standard is snake_case; frontend normalizes both.

---

## 4. API — read paths (return field)

Return `bookingDate` / `booking_date` anywhere a booking token row is exposed:

| Endpoint (conceptual) | Notes |
|-----------------------|--------|
| `GET .../booking-done` (per lead) | Each record in `records[]` |
| `GET /v1/booking-token/deals` (list) | Each deal object |
| `GET .../payment-history` | Optional on summary block |

### Deal list example (fragment)

```json
{
  "id": "uuid",
  "customerName": "Avijit",
  "bookingDate": "2026-09-05",
  "submittedAt": "2026-09-05T10:30:00+05:30"
}
```

---

## 5. Frontend implementation (reference)

| File | Role |
|------|------|
| `app/Components/CrmLeadDetailsV2/BookingDateSection.tsx` | UI + local draft |
| `lib/booking-done-payment-storage.ts` | Draft key `booking-done-booking-date:{leadType}:{leadId}` |
| `lib/booking-token-leads.ts` | `validateBookingDoneHandoff`, `buildBookingDoneSubmitPayload` includes `bookingDate` |
| `lib/booking-done-api.ts` | `BookingDoneSubmitInput.bookingDate`; POST body includes `bookingDate` |

**Note:** After Hub deploy, optionally hydrate booking date from GET record instead of localStorage when reopening the modal.

---

## 6. Distinction: `booking_date` vs `submitted_at`

| Field | Meaning |
|-------|---------|
| `submitted_at` | When the handoff was saved in CRM (audit / 24h cancellation window) |
| `booking_date` | **Business** booking date chosen by sales (reporting, customer comms) |

Do not derive `booking_date` only from `submitted_at` after go-live; use the request field.

---

## 7. Booking & Token date filters (optional alignment)

Dashboard date filters (`submittedFrom` / `submittedTo` on deals API) currently filter by handoff/submit time. If product wants filters by **booking date**, add query params e.g. `bookingDateFrom`, `bookingDateTo` (or filter on `booking_date` column). Coordinate with `lib/booking-token-date-filter.ts`.

---

## 8. Test checklist

1. POST Booking Done **without** `bookingDate` → `400`.
2. POST with `bookingDate: "2026-13-40"` → `400`.
3. POST with valid `bookingDate` → row stored; GET list shows same date.
4. Existing rows backfilled; list API does not return null for old deals (or returns `submitted_at` date only after backfill).
5. Payment proof upload and payment history unchanged after create.

---

## 9. Rollout

1. Migration: add `booking_date` column + backfill.
2. Deploy Hub: accept on create, persist, return on read.
3. Deploy CRM frontend (already collecting date).
4. Verify one end-to-end handoff on staging; confirm B&T **View** / deal row can show date if UI adds it later.

**Contact:** CRM frontend team for BFF path changes only; no Hub URL changes required beyond Booking Done controller DTO.

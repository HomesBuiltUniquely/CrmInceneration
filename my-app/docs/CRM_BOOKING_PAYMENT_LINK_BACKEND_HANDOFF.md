# Booking payment link — backend handoff

**Status (2026-09-05):** Hub matches this contract — one active unpaid link, cancel/delete, activity history, **409** `PAYMENT_LINK_ACTIVE` on double-create. FE is wired: Delete → `cancel` (fallback `delete`), Send disabled while active, 409 syncs banner from `attempt`.

Frontend (Send Payment modal) keeps **one active unpaid link** at a time. Summary amount cards stay as-is; the pending link bar sits **under those cards**. Payment history is separate (click opens payment detail). To send another link, sales must **delete** the open link (or wait until paid / expired / switch offline).

## Activity History UI (FE)

Lead Activity History has a separate **Payments** tab (same level as **Booking & Token**).

Inside **Payments**, FE splits rows by `rawActivityType`:

| Sub-filter | Types |
|---|---|
| **Links** | `BOOKING_PAYMENT_LINK_*`, `…_DELIVERY_FAILED`, `…_NOT_DELIVERED`, `…_EXPIRED` |
| **Received** | `BOOKING_PAYMENT_PAID`, `…_STAGE`, `…_FAILED`, `…_SWITCH_OFFLINE`, `…_ANOMALY` |

Hub should keep emitting `BOOKING_PAYMENT_*` (not `BOOKING_TOKEN_*`) so FE maps `activityType` → Payments section. Booking handoff / cancel / restore stay under Booking & Token.

## Rule (product)

| Situation | Allowed |
|---|---|
| No active link | Create / send new Easebuzz link |
| Active `PENDING` / `CREATED_NOT_DELIVERED` | Resend, copy, edit amount, delete, switch offline — **not** a second create |
| Paid (`PAID`) / expired (`EXPIRED`) / deleted / cancelled | Active clears → create allowed again |
| Switch offline | Cancels online attempt; FE records offline proof |

Hub must **reject** `POST .../payment-links` (create) with **409** (or 400) if an unpaid active attempt already exists for that deal/lead.

## Endpoints (already proxied by FE)

Deal scope:

- `POST /v1/booking-token/deals/{recordId}/payment-links` — create + send
- `GET  /v1/booking-token/deals/{recordId}/payment-links/active` — current banner attempt or `null`
- `POST /v1/booking-token/payment-links/{attemptId}/copy`
- `POST /v1/booking-token/payment-links/{attemptId}/resend`
- `POST /v1/booking-token/payment-links/{attemptId}/edit` — body `{ "amount": number }`
- `POST /v1/booking-token/payment-links/{attemptId}/switch-offline`
- `POST /v1/booking-token/payment-links/{attemptId}/cancel` **or** `.../delete` — **required** for “Delete link”

Lead scope (Booking Done / lead detail) mirrors under `/v1/leads/{type}/{id}/payment-links…`.

### Delete / cancel contract

`POST .../cancel` (preferred) or `POST .../delete`:

**Request:** empty body or `{}`.

**Success response:**

```json
{
  "success": true,
  "attempt": {
    "id": "att_…",
    "status": "CANCELLED",
    "amount": 4707,
    "recordId": "…",
    "leadType": "GL",
    "leadId": "…",
    "cancelledAt": "2026-09-05T10:15:00.000Z",
    "cancelledBy": "admin"
  }
}
```

**Effects Hub must do:**

1. Invalidate Easebuzz / payment URL (customer cannot pay).
2. Clear “active” for `GET …/active` (return null / non-banner status).
3. Append **activity history** row on the lead (see below).
4. Do **not** create a payment history settlement row (no money received).

FE tries `cancel` first; on **404** retries `delete`.

## Attempt object (properties FE reads)

| Property | Type | Notes |
|---|---|---|
| `id` | string | Attempt id (required) |
| `status` | string | Banner when `PENDING` or `CREATED_NOT_DELIVERED`. Also: `PAID`, `EXPIRED`, `CANCELLED` / `DELETED`, offline-switched |
| `amount` | number | Link amount (₹) |
| `paymentLinkUrl` / `linkUrl` | string? | For copy |
| `createdAt` | ISO string | Sent time |
| `expiresAt` | ISO string | Expiry bar |
| `whatsappStatus` / `emailStatus` / `smsStatus` | `SENT` \| `FAILED` \| `SKIPPED` | Channel chips |
| `sendCount` / `copyCount` | number? | Footer counts |
| `salesUserName` | string? | “by admin” |
| `warnings` | string[]? | Soft delivery issues |

Aliases snake_case accepted (`expires_at`, `payment_link_url`, …).

## Activity history (lead Activity) — required events

Write CRM activity rows so Lead Detail / Activity History shows the full link lifecycle. Prefer `rawActivityType` (or equivalent) exactly as below.

| `rawActivityType` | When | Suggested description / change fields |
|---|---|---|
| `BOOKING_PAYMENT_LINK_SENT` | Create + first send | amount, attemptId, channels |
| `BOOKING_PAYMENT_LINK_RESENT` | Resend | attemptId, amount |
| `BOOKING_PAYMENT_LINK_COPIED` | Copy | attemptId (optional) |
| `BOOKING_PAYMENT_LINK_EDITED` | Edit amount | oldAmount → newAmount, attemptId |
| `BOOKING_PAYMENT_LINK_DELETED` or `BOOKING_PAYMENT_LINK_CANCELLED` | Delete/cancel | attemptId, amount, reason=`user_deleted` |
| `BOOKING_PAYMENT_SWITCH_OFFLINE` | Switch offline | attemptId, amount |
| `BOOKING_PAYMENT_EXPIRED` | TTL / Easebuzz expiry | attemptId, amount |
| `BOOKING_PAYMENT_PAID` | Webhook paid | amount, Token vs Booking cues |
| `BOOKING_PAYMENT_STAGE` | Milestone → Token Done / Booking Done | old → new stage |
| `BOOKING_PAYMENT_FAILED` | Reserved (pay failure) | attemptId |
| `BOOKING_PAYMENT_DELIVERY_FAILED` / `BOOKING_PAYMENT_NOT_DELIVERED` | Channel failures | channel statuses |
| `BOOKING_PAYMENT_LINK_SUPERSEDED` | If Hub ever auto-replaces a link | oldAttemptId → newAttemptId |

### Suggested activity payload shape

```json
{
  "activityType": "BOOKING_PAYMENT_LINK_DELETED",
  "title": "Payment link deleted",
  "description": "Cancelled unpaid Easebuzz link ₹4,707 so a new link can be sent.",
  "actorName": "admin",
  "metadata": {
    "attemptId": "att_…",
    "recordId": "…",
    "amount": 4707,
    "previousStatus": "PENDING",
    "reason": "user_deleted"
  }
}
```

FE maps known types in `booking-payment-activity.ts` (including deleted/cancelled titles).

## Create conflict response (when active link exists)

```json
{
  "success": false,
  "error": "An unpaid payment link is already active. Delete it, wait for payment, or switch to offline.",
  "code": "PAYMENT_LINK_ACTIVE",
  "attempt": { "id": "att_…", "status": "PENDING", "amount": 4707 }
}
```

Status **409** preferred.

## FE behaviour summary

1. Summary cards unchanged; pending link bar **under** Total / 10% / Paid / Remaining.
2. Send button disabled while active link exists (`Link open — delete to send another`).
3. Delete calls `cancel`/`delete` → clears banner → Send enabled.
4. Payment history click opens payment detail; “Back to send payment” returns to Online/Offline composer.
5. Paid / expired / deleted / switch-offline all clear active via `GET …/active` (FE also polls).

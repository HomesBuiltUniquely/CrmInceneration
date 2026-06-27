# Booking Token Listing Type — Backend Handoff

**Status:** Hub backend implemented  
**Audience:** Hub / Spring backend team (`Project-ERP`)  
**Frontend repo:** `CrmInceneration/my-app`  
**Related:** `booking_token_record`, [BOOKING_PAYMENT_HISTORY_BACKEND_HANDOFF.md](./BOOKING_PAYMENT_HISTORY_BACKEND_HANDOFF.md)

---

## 1. Executive summary

The Super Admin **Booking & Token** dashboard has four tabs:

| Tab | What the user sees |
|-----|-------------------|
| **All** | Every active deal (token + booking buckets) |
| **Booking** | Only leads that **completed full 10%** (`payment_kind = FULL_10%`, `remaining_amount = 0`) |
| **Token** | Leads still paying toward 10% (partial / token stage) |
| **Cancel** | Deals cancelled via Cancellation action (within 24h window) |

Today the frontend can **derive** bucket from `payment_kind`, `remaining_amount`, and `booking_status`. Product needs a **stored column** on `booking_token_record` so list APIs can filter efficiently and transitions are explicit.

**Recommendation:** Add column **`listing_type`** with values `token`, `booking`, `cancel`.

---

## 2. Database change

### Table: `booking_token_record`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `listing_type` | `VARCHAR(16)` or `ENUM('token','booking','cancel')` | NOT NULL | `'token'` | Dashboard bucket |

**Index:** `CREATE INDEX idx_booking_token_listing_type ON booking_token_record (listing_type);`

Optional composite for list API:

```sql
CREATE INDEX idx_booking_token_listing_submitted
  ON booking_token_record (listing_type, submitted_at DESC);
```

### Backfill (idempotent)

```sql
UPDATE booking_token_record
SET listing_type = 'cancel'
WHERE LOWER(booking_status) = 'cancelled';

UPDATE booking_token_record
SET listing_type = 'booking'
WHERE (listing_type IS NULL OR listing_type = 'token')
  AND LOWER(COALESCE(booking_status, '')) <> 'cancelled'
  AND (
    UPPER(payment_kind) = 'FULL_10%'
    OR COALESCE(remaining_amount, 0) <= 0
  );

UPDATE booking_token_record
SET listing_type = 'token'
WHERE listing_type IS NULL
  AND LOWER(COALESCE(booking_status, '')) <> 'cancelled';
```

Run on startup via `BookingTokenListingTypeBackfillRunner` (same pattern as payment history backfill).

---

## 3. When `listing_type` changes

| Event | New `listing_type` | Also update |
|-------|-------------------|-------------|
| **Booking Done submit** — partial payment (`TOKEN`) | `token` | `payment_kind`, `remaining_amount` |
| **Booking Done submit** — full 10% upfront | `booking` | `payment_kind = FULL_10%` |
| **Pay action** — cumulative reaches 10% | `token` → `booking` | `payment_kind = FULL_10%`, `remaining_amount = 0` |
| **Pay action** — still partial | stays `token` | — |
| **POST cancel** (Cancellation button) | `cancel` | `booking_status = cancelled`, store `cancellation_reason`, `cancelled_at` |

### Suggested extra columns (optional but useful)

| Column | Purpose |
|--------|---------|
| `cancellation_reason` | TEXT — from cancel popup |
| `cancelled_at` | TIMESTAMP |
| `cancelled_by` | User id / name |

---

## 4. API — list deals (extend existing)

```
GET /v1/booking-token/deals
GET /api/crm/booking-token/deals
```

### Query parameters

| Param | Values | Behaviour |
|-------|--------|-----------|
| `page` | int | Existing pagination |
| `size` | int | Existing pagination |
| `search` | string | Existing search |
| **`listingType`** | `token` \| `booking` \| `cancel` | Filter by bucket |
| *(omit `listingType`)* | — | Return **all active** (`listing_type IN ('token','booking')`) — used by **All** tab |

**Deprecated (migration):** `bookingStatus=active|cancelled` — replace with `listingType` where possible.

### Response — each deal object

Add field:

```json
{
  "id": "uuid",
  "listingType": "token",
  "paymentKind": "TOKEN",
  "remainingAmount": 16690,
  "bookingStatus": "in_progress"
}
```

Frontend maps `listingType` directly; falls back to deriving from `paymentKind` / `remainingAmount` / `bookingStatus` if missing.

---

## 5. API — cancel deal

```
POST /v1/booking-token/deals/{recordId}/cancel
```

**Body (full deal):**

```json
{
  "reason": "Customer changed plan",
  "scope": "deal"
}
```

**Body (partial — selected payments):**

```json
{
  "reason": "Duplicate payment proof",
  "scope": "payments",
  "paymentHistoryEntryIds": ["ph-entry-uuid-1", "ph-entry-uuid-2"]
}
```

| Field | Required |
|-------|----------|
| `reason` | Yes |
| `scope` | Yes — `deal` \| `payments` |
| `paymentHistoryEntryIds` | Yes when `scope = payments` (non-empty array) |

**Validation:**

- Reject if already `listing_type = cancel` (full deal cancel)
- Reject if outside 24h cancellation window (from `submitted_at` / `created_at`)
- Partial: each id must exist in `payment_history` and not already cancelled
- Partial: if all active payments cancelled → same as `scope: deal`

**Partial cancel side effects:**

- Mark entries `status: cancelled` in `payment_history` JSON (add field)
- Recalculate `amount_received`, `remaining_amount`, `payment_kind`, `listing_type`
- Deal stays `token` if remaining > 0; moves to `cancel` only when `scope = deal` or no payments left

**Success `200` (full):**

```json
{
  "id": "uuid",
  "listingType": "cancel",
  "bookingStatus": "cancelled",
  "cancellationReason": "Customer changed plan",
  "cancelledAt": "2026-06-27T12:00:00Z"
}
```

**Success `200` (partial):**

```json
{
  "id": "uuid",
  "listingType": "token",
  "amountReceived": 5000,
  "remainingAmount": 16690,
  "cancelledPaymentEntryIds": ["ph-entry-uuid-1"]
}
```

---

## 6. Pay action — auto promote token → booking

When `POST .../payments` completes and `remaining_amount` becomes `0`:

- `payment_kind = FULL_10%`
- `listing_type = booking`
- `remaining_amount = 0`

Row moves from **Token** tab to **Booking** tab.

---

## 7. Frontend wiring (Next.js — done)

| Tab | `listingType` query param |
|-----|---------------------------|
| All | *(none)* |
| Booking | `listingType=booking` |
| Token | `listingType=token` |
| Cancel | `listingType=cancel` |

**BFF:** forwards query string to Hub.  
**Fallback:** `lib/booking-token-listing-type.ts` filters client-side if Hub omits param.

---

## 8. Business rules

```
listing_type = token    → partial 10%, Pay + Cancellation (24h)
listing_type = booking  → full 10% paid, Convert to Booking
listing_type = cancel   → Cancel tab, View only
```

---

## 9. Test checklist

- [ ] Token submit → All + Token tabs only
- [ ] Full 10% submit → All + Booking tabs only
- [ ] Pay to complete 10% → moves Token → Booking
- [ ] Cancel within 24h → Cancel tab only
- [ ] `GET deals?listingType=booking` returns only full-10% rows

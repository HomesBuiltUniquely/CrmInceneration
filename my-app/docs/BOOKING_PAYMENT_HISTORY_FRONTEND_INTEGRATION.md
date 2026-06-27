# Booking Payment History (View popup) — Frontend Integration

**Status:** Hub backend implemented · Frontend wired  
**Audience:** Next.js BFF + Booking & Token UI (`CrmInceneration/my-app`)  
**Backend repo:** `Project-ERP`  
**Related:** [BOOKING_PAYMENT_HISTORY_BACKEND_HANDOFF.md](./BOOKING_PAYMENT_HISTORY_BACKEND_HANDOFF.md)

---

## 1. What shipped on Hub

| API | Status |
|-----|--------|
| `GET .../deals/{recordId}/payment-history` | ✅ Phase 1 |
| `GET .../deals/{recordId}/payment-proofs/{proofId}/content` | ✅ Phase 1 |
| `POST .../deals/{recordId}/payments` | ✅ Phase 2 (Pay button) |
| First Booking Done submit → history entry #1 | ✅ Auto on create |
| Proof upload → attached to entry #1 | ✅ |
| Startup backfill for old rows | ✅ |

**Storage:** `booking_token_record.payment_history` JSON array (same table, not a child table).

---

## 2. Hub paths (both work)

```
/v1/booking-token/...
/api/crm/booking-token/...
```

BFF proxies with `Authorization: Bearer {token}` unchanged.

---

## 3. Frontend wiring (done)

| UI action | Client call | Component |
|-----------|-------------|-----------|
| **View** | `GET /api/crm/booking-token/deals/{recordId}/payment-history` | `BookingPaymentPanel` mode `view` |
| **Pay** | `POST /api/crm/booking-token/deals/{recordId}/payments` | `BookingPaymentPanel` mode `pay` |
| Proof thumbnails | `GET /api/crm/booking-token/deals/{recordId}/payment-proofs/{proofId}/content` | `PaymentProofThumbnail` (fetch + blob URL; img tags cannot send Bearer auth) |

### BFF routes

| BFF | Hub |
|-----|-----|
| `app/api/crm/booking-token/deals/[recordId]/payment-history/route.ts` | GET |
| `app/api/crm/booking-token/deals/[recordId]/payment-proofs/[proofId]/content/route.ts` | GET stream |
| `app/api/crm/booking-token/deals/[recordId]/payments/route.ts` | POST multipart |

### Lib

| File | Purpose |
|------|---------|
| `lib/booking-payment-history-api.ts` | fetch history, submit payment, BFF proof URLs |
| `lib/booking-payment-upstream.ts` | Hub URL builders for BFF |

### UI files

| File | Purpose |
|------|---------|
| `app/Components/BookingToken/components/DealsTable.tsx` | View / Pay button handlers |
| `app/Components/BookingToken/components/BookingPaymentPanel.tsx` | Draggable modal — summary, timeline, pay form |
| `app/Components/BookingToken/components/PaymentProofThumbnail.tsx` | Authenticated proof preview |

---

## 4. GET payment history (View popup)

```
GET /v1/booking-token/deals/{recordId}/payment-history
```

**Roles:** `SUPER_ADMIN`, `ADMIN`, `SALES_ADMIN`

**Response highlights:**

- Top-level deal summary: `quoteAmount`, `tenPercentAmount`, `amountReceived`, `remainingAmount`
- `history[]` — oldest first (`sequence` ascending)
- Each entry: `amount`, `cumulativeReceived`, `remainingAfter`, `paymentKind`, `source`, `proofs[]`
- Each proof includes `viewUrl`: `/v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content` — **frontend always maps to BFF proxy**
- `summary`: `{ paymentCount, proofCount, lastPaymentAt }`

---

## 5. GET proof image

Hub returns binary stream. Frontend fetches via BFF with `getCrmAuthHeaders()` and displays a blob URL (same pattern as floor plan preview).

---

## 6. POST additional payment (Pay button)

```
POST /v1/booking-token/deals/{recordId}/payments
Content-Type: multipart/form-data
```

| Field | Required |
|-------|----------|
| `amount` | Yes |
| `notes` | No |
| `files` | No (proof screenshots; multiple allowed) |

**Validation (Hub):**

- Rejects if deal `bookingStatus = cancelled`
- Rejects if payment would exceed `tenPercentAmount`
- Rejects if `remainingAmount` already `0`

On success: panel reloads history and deals table refreshes.

---

## 7. Payment flow recap

```text
Booking Done submit     → history entry #1 (source: booking_done)
Upload proofs           → proofs linked to entry #1
Pay action (dashboard)  → history entry #2, #3, … (source: pay_action)
Aggregates auto-update  → amountReceived, remainingAmount, paymentKind
```

When `remainingAmount` reaches `0`, `paymentKind` becomes `FULL_10%` and **Convert to Booking** appears on the deal row.

---

## 8. Example timeline (UI)

```
Deal value     ₹1,00,000
10% target     ₹10,000
Total received ₹10,000
Remaining      ₹0

Payment 1 · ₹5,000 · TOKEN · Booking Done
Payment 2 · ₹5,000 · FULL 10% · Pay action
```

---

## 9. Notes

- Payment timeline is **not** stored in localStorage; only Hub `payment_history` JSON.
- Booking Done page still uses localStorage for draft amount/proofs **before** first submit — cleared after successful handoff.
- If Hub returns `503`, frontend falls back to deal-row summary (no fabricated history entries).

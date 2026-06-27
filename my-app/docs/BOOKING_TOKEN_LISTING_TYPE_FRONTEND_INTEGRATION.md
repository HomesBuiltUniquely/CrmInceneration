# Booking Token Listing Type — Frontend Integration

**Status:** Hub backend implemented · Frontend wired  
**Audience:** Next.js BFF + Booking & Token dashboard (`CrmInceneration/my-app`)  
**Backend repo:** `Project-ERP`  
**Related:** [BOOKING_TOKEN_LISTING_TYPE_BACKEND_HANDOFF.md](./BOOKING_TOKEN_LISTING_TYPE_BACKEND_HANDOFF.md), [BOOKING_PAYMENT_HISTORY_FRONTEND_INTEGRATION.md](./BOOKING_PAYMENT_HISTORY_FRONTEND_INTEGRATION.md)

---

## 1. What Hub stores

Column **`listing_type`** on `booking_token_record`:

| Value | Tab | Meaning |
|-------|-----|---------|
| `token` | Token | Partial 10% — Pay + Cancel (24h) |
| `booking` | Booking | Full 10% paid — Convert to Booking |
| `cancel` | Cancel | Cancelled — View only |

Frontend **reads `listingType` from API** — client derive only when field is missing (legacy rows).

Optional cancel fields: `cancellationReason`, `cancelledAt`.

---

## 2. Tab → API query (implemented)

**Tab order (left → right):** All | Token | Booking | Cancel

| Tab | Fetch |
|-----|-------|
| All | `GET /api/crm/booking-token/deals?page=0&size=50` |
| Token | `...&listingType=token` |
| Booking | `...&listingType=booking` |
| Cancel | `...&listingType=cancel` |

**Lib:** `fetchBookingTokenDeals({ listingType })` in `lib/booking-done-api.ts`  
**Tab helper:** `listingTypeQueryForTab()` in `lib/booking-token-listing-type.ts`

---

## 3. Row actions by `listingType` (implemented)

| `listingType` | Actions |
|---------------|---------|
| `token` | View, Pay, Cancellation (if within 24h of `submittedAt`) |
| `booking` | View, Convert to Booking |
| `cancel` | View only |

**Helpers:** `canShowPay`, `canShowConvert`, `canShowCancellation` in `lib/booking-token-listing-type.ts`  
**Mapper:** `bookingTokenDealToDealRow()` sets flags from Hub `listingType`.

---

## 4. Cancel flow

```
POST /api/crm/booking-token/deals/{recordId}/cancel
```

**Body:**

```json
{
  "reason": "Customer changed plan",
  "scope": "deal"
}
```

Partial — cancel selected payments only:

```json
{
  "reason": "Wrong UPI entry",
  "scope": "payments",
  "paymentHistoryEntryIds": ["entry-uuid-1", "entry-uuid-2"]
}
```

| `scope` | Behaviour |
|---------|-----------|
| `deal` | Entire deal → Cancel tab (`listingType = cancel`) |
| `payments` | Void selected history entries only; recalc `amountReceived` / `remainingAmount`; deal stays on Token tab if payments remain |

Selecting **all** payments in the UI sends `scope: "deal"`.

**UI:** `CancelDealConfirmModal` — radio (entire deal vs selected payments), checkboxes on history, reason field.

---

## 5. Pay flow — token → booking

```
POST /api/crm/booking-token/deals/{recordId}/payments
```

When 10% complete, Hub sets `listingType: "booking"`. Pay response includes `listingType`.  
Frontend refreshes deals list after success (`onUpdated` in `DealsTable`).

---

## 6. Frontend files

| File | Role |
|------|------|
| `BookingTokenClient.tsx` | All \| Booking \| Token \| Cancel tabs |
| `DealsTable.tsx` | Filter + actions by `listingType` |
| `lib/booking-token-listing-type.ts` | Hub read + fallback derive + action helpers |
| `lib/booking-token-leads.ts` | Deal row mapper |
| `lib/booking-done-api.ts` | `fetchBookingTokenDeals`, `cancelBookingTokenDeal` |
| `CancelDealConfirmModal.tsx` | Cancel popup |

---

## 7. Deprecated

`bookingStatus=active|cancelled` on list API — use `listingType` only.

---

## 8. Checklist

- [x] All tab: no `listingType` param
- [x] Booking / Token / Cancel: pass `listingType`
- [x] Actions keyed off `deal.listingType`
- [x] Cancel only when `listingType === "token"` + 24h window
- [x] Fallback derive if `listingType` absent
- [x] Refresh list after Pay / Cancel

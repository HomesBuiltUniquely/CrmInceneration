# Booking Payment History (View popup) — Backend Handoff

**Status:** Required for Booking & Token **View** button  
**Audience:** Hub / Spring backend team (`Project-ERP`)  
**Frontend repo:** `CrmInceneration/my-app` (Next.js BFF + Booking & Token UI)  
**Related:** `booking_token_record`, existing Booking Done submit + payment proof upload

---

## 1. Executive summary

On the **Booking & Token** dashboard, each deal row has a **View** action. Clicking it must open a **draggable popup** (same UX pattern as **Activity History** on Lead Details V2) showing:

- Deal / quote summary (total value, 10% target, amount received so far, remaining)
- **Chronological payment history** (every payment event, not only the first Booking Done submit)
- **Payment proof screenshots** per event (thumbnail + click to view full image)

**Example**

| Field | Value |
|-------|-------|
| Quote / deal total | ₹1,00,000 |
| 10% booking target | ₹10,000 |
| Payment 1 | ₹5,000 (with screenshot) |
| Payment 2 | ₹5,000 (with screenshot) |
| **Total received** | ₹10,000 |
| **Remaining** | ₹0 → Convert to Booking enabled |

Today `booking_token_record` stores a **single** `amountReceived` and `payment_proofs` JSON from the initial Booking Done handoff. Product needs **multiple payment entries over time** (initial handoff + future **Pay** button on the dashboard).

**Recommendation:** Add a **`payment_history`** JSON array (or normalized child rows) on `booking_token_record`, plus APIs to **read history** and **append a payment** (Pay flow).

---

## 2. UI trigger (frontend)

| Location | Action |
|----------|--------|
| `/booking-token` → deals table → **View** | Opens payment history panel |
| Panel UX | Match `ActivityHistoryWithConnector.tsx` — centered draggable modal, list + detail, Escape to close |

**Frontend will call (after Hub ships):**

```
GET /api/crm/booking-token/deals/{recordId}/payment-history
GET /api/crm/booking-token/deals/{recordId}/payment-proofs/{proofId}/content
POST /api/crm/booking-token/deals/{recordId}/payments   (Phase 2 — Pay button)
```

BFF proxies to Hub with `Authorization: Bearer {token}` unchanged.

---

## 3. Data model

### 3.1 Existing (`booking_token_record`)

Already stored on first **Open Booking & Token**:

- `quote_amount`, `ten_percent_amount`, `amount_received`, `remaining_amount`
- `payment_proofs` JSON (files from first upload)
- `payment_kind`, `token_status`, `booking_status`

### 3.2 New — `payment_history` (JSON on same row recommended)

Store an ordered array on `booking_token_record.payment_history` (or separate table `booking_payment_entry` if you prefer SQL reporting).

**Each entry:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID string | Yes | Stable id for UI selection |
| `sequence` | int | Yes | 1-based order (oldest = 1) |
| `amount` | number | Yes | This payment only (e.g. 5000) |
| `cumulativeReceived` | number | Yes | Running total after this payment |
| `remainingAfter` | number | Yes | `tenPercentAmount - cumulativeReceived` (min 0) |
| `paymentKind` | string | Yes | `TOKEN` \| `PARTIAL` \| `FULL_10%` — kind **after** this payment |
| `source` | string | Yes | `booking_done` \| `pay_action` \| `admin_adjustment` |
| `recordedBy` | string | No | Display name from JWT user |
| `recordedByUserId` | string/number | No | Audit |
| `notes` | string | No | Optional memo |
| `createdAt` | ISO-8601 | Yes | When payment was recorded |
| `proofs` | array | No | Same shape as `payment_proofs` (see §3.3) |

**On first Booking Done submit:** Hub should **append entry #1** to `payment_history` using the submit payload + uploaded proofs (do not rely on frontend to call a separate history API for the first payment).

**On Pay button (Phase 2):** Append entry #2, #3, … and update aggregate fields:

```text
amount_received = sum(payment_history[].amount)
remaining_amount = max(0, ten_percent_amount - amount_received)
payment_kind = remaining_amount == 0 ? FULL_10% : TOKEN
```

### 3.3 Payment proof object (unchanged + view URL)

Extend existing `BookingPaymentProof` POJO:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `originalFileName` | string | |
| `mimeType` | string | `image/png`, `image/jpeg`, `application/pdf` |
| `sizeBytes` | number | |
| `s3Key` | string | Internal — e.g. `booking-payment-proofs/addlead/1845/{recordId}/{uuid}-payment.png` |
| `uploadedAt` | ISO-8601 | |
| `uploadedBy` | string | |
| `paymentHistoryEntryId` | string | Links proof to a specific history row |

**Do not** return raw S3 credentials to the browser. Expose **authenticated proxy URLs** (same pattern as floor plan):

```
GET .../payment-proofs/{proofId}/content  → stream bytes or short-lived presigned redirect
```

---

## 4. API reference

### 4.1 Get payment history (View popup) — **Phase 1 required**

```
GET /v1/booking-token/deals/{recordId}/payment-history
GET /api/crm/booking-token/deals/{recordId}/payment-history
Authorization: Bearer ...
```

**Roles:** `SUPER_ADMIN`, `ADMIN`, `SALES_ADMIN` (same as deals list).

**Success `200`:**

```json
{
  "recordId": "550e8400-e29b-41d4-a716-446655440000",
  "leadType": "addlead",
  "leadId": 1845,
  "leadIdentifier": "AL-JSILSZYO0B",
  "customerName": "fresh lead hub 26",
  "customerPhone": "9876543210",
  "quoteId": "70013",
  "quoteAmount": 100000,
  "tenPercentAmount": 10000,
  "amountReceived": 10000,
  "remainingAmount": 0,
  "paymentKind": "FULL_10%",
  "tokenStatus": "not_applicable",
  "bookingStatus": "in_progress",
  "quoteVerifyUrl": "https://design.hubinterior.com/quote/70013?...",
  "submittedAt": "2026-06-27T10:00:00Z",
  "history": [
    {
      "id": "pay-entry-1",
      "sequence": 1,
      "amount": 5000,
      "cumulativeReceived": 5000,
      "remainingAfter": 5000,
      "paymentKind": "TOKEN",
      "source": "booking_done",
      "recordedBy": "Sales User",
      "notes": "Initial token from Booking Done",
      "createdAt": "2026-06-27T10:00:00Z",
      "proofs": [
        {
          "id": "proof-uuid-1",
          "originalFileName": "upi-1.png",
          "mimeType": "image/png",
          "sizeBytes": 84210,
          "uploadedAt": "2026-06-27T10:00:01Z",
          "uploadedBy": "Sales User",
          "viewUrl": "/api/crm/booking-token/deals/550e8400-e29b-41d4-a716-446655440000/payment-proofs/proof-uuid-1/content"
        }
      ]
    },
    {
      "id": "pay-entry-2",
      "sequence": 2,
      "amount": 5000,
      "cumulativeReceived": 10000,
      "remainingAfter": 0,
      "paymentKind": "FULL_10%",
      "source": "pay_action",
      "recordedBy": "Super Admin",
      "notes": "Second installment via Pay",
      "createdAt": "2026-06-27T11:30:00Z",
      "proofs": [
        {
          "id": "proof-uuid-2",
          "originalFileName": "bank-transfer.png",
          "mimeType": "image/png",
          "sizeBytes": 120400,
          "uploadedAt": "2026-06-27T11:30:05Z",
          "uploadedBy": "Super Admin",
          "viewUrl": "/api/crm/booking-token/deals/550e8400-e29b-41d4-a716-446655440000/payment-proofs/proof-uuid-2/content"
        }
      ]
    }
  ],
  "summary": {
    "paymentCount": 2,
    "proofCount": 2,
    "lastPaymentAt": "2026-06-27T11:30:00Z"
  }
}
```

**Errors:**

| Status | When |
|--------|------|
| `401` | Not logged in |
| `403` | Role not allowed |
| `404` | Unknown `recordId` |

**Sorting:** `history` **oldest first** (`sequence` ascending). Frontend may reverse for “newest on top” if needed.

---

### 4.2 View payment proof image — **Phase 1 required**

```
GET /v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content
GET /api/crm/booking-token/deals/{recordId}/payment-proofs/{proofId}/content
Authorization: Bearer ...
```

**Success `200`:** Binary stream with correct `Content-Type` (mirror `GET .../floor-plan/content`).

**Errors:** `404` if proof not on record; `403` if user cannot access deal.

**Optional:** Return `{ "redirectUrl": "https://..." }` with presigned S3 URL (5–15 min TTL) instead of streaming — frontend supports either.

---

### 4.3 Record additional payment (Pay button) — **Phase 2**

```
POST /v1/booking-token/deals/{recordId}/payments
POST /api/crm/booking-token/deals/{recordId}/payments
Content-Type: multipart/form-data
Authorization: Bearer ...
```

**Form fields:**

| Field | Required | Notes |
|-------|----------|-------|
| `amount` | Yes | Payment amount (> 0) |
| `notes` | No | Text memo |
| `files` | No | One or more proof images (same rules as booking-done proofs, max 10 MB each) |

**Success `201`:** Same shape as one `history[]` entry + updated top-level totals (`amountReceived`, `remainingAmount`, `paymentKind`).

**Validation:**

- Reject if deal is **cancelled**
- Reject if `amount` would make `cumulativeReceived > tenPercentAmount` unless product allows overpayment (default: **reject** with `400`)
- Reject if `remainingAmount` already `0` unless overpayment allowed

---

### 4.4 Cancel deal (Cancellation button / Cancel tab) — **Phase 3**

```
POST /v1/booking-token/deals/{recordId}/cancel
```

Body: `{ "reason": "..." }`  
Sets `booking_status = cancelled`, excludes from active deals list, includes in cancelled tab. Out of scope for View popup but listed for completeness.

---

## 5. Migration / backfill

For existing rows in `booking_token_record` created **before** `payment_history` exists:

1. For each row with `amount_received > 0`, insert **one** synthetic history entry:
   - `source: "booking_done"`
   - `amount: amount_received`
   - `cumulativeReceived: amount_received`
   - `remainingAfter: remaining_amount`
   - `proofs: payment_proofs` (existing JSON)
2. Set `sequence: 1`

SQL/Java migration script should be idempotent.

---

## 6. Suggested Hub files

| File | Purpose |
|------|---------|
| `BookingPaymentHistoryEntry.java` | JSON POJO for one history row |
| `BookingTokenService.getPaymentHistory(recordId)` | Build response + summary |
| `BookingTokenService.addPayment(recordId, amount, proofs)` | Pay flow |
| `BookingTokenPaymentHistoryController.java` | GET history, GET proof content, POST payment |
| Extend `BookingDoneController` submit | Append first `payment_history` entry on create |

**S3:** Reuse bucket `hubinterior-quote-2026`, prefix `booking-payment-proofs/`.

---

## 7. Suggested Next.js BFF routes

| BFF route | Proxies to |
|-----------|------------|
| `app/api/crm/booking-token/deals/[recordId]/payment-history/route.ts` | GET Hub payment-history |
| `app/api/crm/booking-token/deals/[recordId]/payment-proofs/[proofId]/content/route.ts` | GET proof bytes |
| `app/api/crm/booking-token/deals/[recordId]/payments/route.ts` | POST multipart (Phase 2) |

Forward `Authorization` and `Cookie` via `upstreamAuthHeaders(req)`.

---

## 8. Frontend integration plan (after Hub ships)

1. **`PaymentHistoryPanel.tsx`** — clone interaction from `ActivityHistoryWithConnector.tsx`:
   - Left: timeline list (`Payment 1 — ₹5,000`, date, user)
   - Right: detail + proof thumbnails
   - Header summary card: Quote total, 10% target, Received, Remaining
2. **`DealsTable.tsx`** — **View** opens panel with `recordId` from deal row
3. **`lib/booking-payment-history-api.ts`** — `fetchPaymentHistory(recordId)`, proof URL helper
4. Extend `DealRow` with `recordId`, `leadType`, `leadId` from deals API (already on `BookingTokenDeal.id`)
5. **Pay** button → Phase 2 POST + refresh history
6. Thumbnails use `viewUrl` with CRM auth cookies (same as floor plan `<img src="/api/crm/.../content">`)

---

## 9. Testing checklist

- [ ] GET payment-history returns summary + ordered `history[]`
- [ ] First Booking Done submit creates history entry #1 with proofs
- [ ] GET proof content returns image for authenticated Super Admin
- [ ] Second payment via POST updates cumulative totals (`5000 + 5000 = 10000`, remaining `0`)
- [ ] Each history entry shows its own proof screenshots
- [ ] 404 for unknown record / proof
- [ ] Backfill migration populates history for old rows
- [ ] Frontend View popup renders without localStorage

---

## 10. Example timeline (UI copy)

```
Payment History — fresh lead hub 26 (AL-JSILSZYO0B)

Deal value     ₹1,00,000
10% target     ₹10,000
Total received ₹10,000
Remaining      ₹0

── 27 Jun 2026, 10:00 AM ──
Payment 1 · ₹5,000 · TOKEN
By Sales User · Booking Done handoff
[screenshot thumbnail]

── 27 Jun 2026, 11:30 AM ──
Payment 2 · ₹5,000 · Full 10% reached
By Super Admin · Pay action
[screenshot thumbnail]
```

---

## 11. Contact / frontend owner

When APIs are deployed on `hows.hubinterior.com`, notify frontend with:

- Confirm paths (`/v1/booking-token/...` vs `/api/crm/...`)
- Sample `recordId` from staging
- Whether `viewUrl` is relative BFF path or absolute presigned URL

Frontend will wire **View** immediately after Phase 1 (GET history + GET proof content) is available.

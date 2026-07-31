# Design Module — Refund Process Implementation Guide

**Status:** CRM wired · Design Module must implement API  
**Audience:** Design Module backend + Finance team  
**CRM caller:** `lib/design-module-hub-sync.ts` → `syncRefundToDesignModule()`  
**Trigger:** Manager **Approve cancellation** in CRM Booking & Token

---

## 1. Simple flow (Hindi + English)

```
Sales cancel request (24h window)
    ↓
Manager Approve (CRM)
    ↓
Hub: milestone → Refund Processed
    ↓
CRM BFF: POST Design Module finance-refund-sync   ← ab wired hai
    ↓
Design Module: refund record + finance reversal
```

**Aapko kya karna hai:** Design Module mein ek API banao jo payment history le kar **refund task / ledger reversal** create kare.

---

## 2. When CRM calls you

| Event | CRM action | Design Module endpoint |
|-------|------------|------------------------|
| Convert booking (10% / 9.9% buffer) | `syncConvertBookingToDesignModule` | `POST /api/hub/crm-lead/convert-booking` |
| **Manager approve cancel** | **`syncRefundToDesignModule`** | **`POST /api/hub/booking-token/finance-refund-sync`** |

Fallback path (404 pe try): `POST /api/hub/crm-lead/refund-booking`

**Auth:** Header `x-api-key: {HUB_SYNC_API_KEY}` (same as convert sync)

---

## 3. API contract

### Request

```http
POST /api/hub/booking-token/finance-refund-sync
Content-Type: application/json
x-api-key: <shared-secret>
```

### Body (example — full deal refund)

```json
{
  "eventType": "refund_processed",
  "bookingTokenRecordId": "c71bb3e6-…",
  "leadType": "formlead",
  "leadId": 12345,
  "leadIdentifier": "AL-EDHTFUX2DN",
  "customerName": "test-lead -for-design",
  "projectName": "test-lead -for-design",
  "quoteAmount": 1000180,
  "tenPercentAmount": 100018,
  "amountReceived": 99018,
  "remainingAmount": 1000,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99018,
  "bookingApprovalMode": "BUFFER_9_9",
  "bufferApplied": true,
  "bufferThresholdAmount": 99018,
  "shortfallAmount": 1000,
  "refundScope": "deal",
  "refundAmount": 99018,
  "amountTowardTenRefund": 99018,
  "extraAmountRefund": 0,
  "cancellationReason": "Customer changed plans",
  "cancelledAt": "2026-07-24T12:00:00Z",
  "cancellationApprovedAt": "2026-07-24T14:00:00Z",
  "cancellationApprovedBy": "Manager Name",
  "cancelledPaymentEntryIds": [],
  "hubProofBaseUrl": "https://hows.hubinterior.com",
  "paymentHistory": [
    {
      "id": "pay-1",
      "sequence": 1,
      "amount": 50000,
      "extraAmount": 0,
      "cumulativeReceived": 50000,
      "remainingAfter": 50018,
      "paymentKind": "TOKEN",
      "source": "booking_done",
      "proofs": [{ "id": "…", "contentPath": "/v1/booking-token/deals/…/payment-proofs/…/content" }]
    },
    {
      "id": "pay-2",
      "sequence": 2,
      "amount": 49018,
      "extraAmount": 0,
      "cumulativeReceived": 99018,
      "remainingAfter": 1000,
      "source": "pay_action"
    }
  ]
}
```

### Response (200 — required shape)

```json
{
  "ok": true,
  "refundId": "ref-2026-001",
  "refundAmount": 99018,
  "designLeadId": 456,
  "bookingTokenRecordId": "c71bb3e6-…"
}
```

CRM reads: `refundId`, `refundAmount`, `designLeadId`.

### Response (400)

```json
{ "message": "No payments to refund" }
{ "message": "Refund already processed for this deal" }
```

---

## 4. Design Module — step-by-step implement kaise karein

### Step 1 — Database table (suggested)

```sql
CREATE TABLE finance_refund_requests (
  id                UUID PRIMARY KEY,
  booking_token_record_id VARCHAR NOT NULL,
  lead_type         VARCHAR NOT NULL,
  lead_id           BIGINT NOT NULL,
  lead_identifier   VARCHAR,
  customer_name     VARCHAR,
  refund_scope      VARCHAR NOT NULL,  -- deal | payments
  refund_amount     DECIMAL(14,2) NOT NULL,
  amount_toward_ten DECIMAL(14,2) NOT NULL DEFAULT 0,
  extra_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_at      TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  approved_by       VARCHAR,
  status            VARCHAR NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSED | FAILED
  design_lead_id    BIGINT,
  payload_json      JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_token_record_id, status)  -- optional: one active refund per deal
);
```

Child table for payment lines:

```sql
CREATE TABLE finance_refund_payment_lines (
  id                   UUID PRIMARY KEY,
  refund_request_id    UUID REFERENCES finance_refund_requests(id),
  payment_history_id   VARCHAR NOT NULL,
  amount               DECIMAL(14,2) NOT NULL,
  extra_amount         DECIMAL(14,2) DEFAULT 0,
  proof_refs           JSONB
);
```

### Step 2 — Controller route

```typescript
// POST /api/hub/booking-token/finance-refund-sync
async function financeRefundSync(req, res) {
  validateApiKey(req.headers['x-api-key']);
  const body = req.body;

  // Idempotency — same bookingTokenRecordId + APPROVED refund
  const existing = await findProcessedRefund(body.bookingTokenRecordId);
  if (existing) {
    return res.json({ ok: true, refundId: existing.id, refundAmount: existing.refund_amount, designLeadId: existing.design_lead_id });
  }

  if (!body.refundAmount || body.refundAmount <= 0) {
    return res.status(400).json({ message: 'No payments to refund' });
  }

  const refund = await createRefundRequest(body);
  await reverseFinanceEntries(refund);  // your ledger logic
  await markRefundProcessed(refund.id);

  return res.json({
    ok: true,
    refundId: refund.id,
    refundAmount: body.refundAmount,
    designLeadId: refund.design_lead_id,
    bookingTokenRecordId: body.bookingTokenRecordId,
  });
}
```

### Step 3 — Finance logic (business rules)

| Field | Refund rule |
|-------|-------------|
| `refundScope = deal` | Refund **full** `refundAmount` (= `totalAmountReceived`) |
| `refundScope = payments` | Refund only rows in `cancelledPaymentEntryIds` |
| `amountTowardTenRefund` | Reverse 10% milestone portion |
| `extraAmountRefund` | Reverse extra bucket separately (if customer overpaid) |
| `bufferApplied = true` | Still refund what customer paid; shortfall (`remainingAmount`) was never collected — **do not** refund shortfall |

**Example:**

- Paid ₹99,018 toward 10% target ₹1,00,018 (buffer convert)  
- Refund customer: **₹99,018** only  
- Shortfall ₹1,000: nothing to refund (never received)

**Overpay example:**

- 10% target ₹1,00,018 · customer paid ₹1,05,000  
- `amountTowardTenRefund = 100018` · `extraAmountRefund = 4982`  
- Refund total ₹1,05,000 split across two ledger buckets

### Step 4 — Link to design lead

- Find or create `design_lead` by `leadType` + `leadId` or `leadIdentifier`
- Store `designLeadId` on refund row
- If convert sync already ran, attach refund to same finance project

### Step 5 — Payment proofs

- Proofs URLs: `{hubProofBaseUrl}{contentPath}`
- CRM sends `contentPath` per proof — fetch from Hub for audit (same as convert)

### Step 6 — Idempotency

- Same `bookingTokenRecordId` + approve twice → return same `refundId` (no double refund)
- Use DB unique constraint or status check

---

## 5. Partial cancel (payments scope)

When `refundScope = "payments"` and `cancelledPaymentEntryIds = ["pay-2"]`:

- Refund only matching `paymentHistory` rows
- `refundAmount` = sum of those entries' `amount`
- Do not refund non-selected payments

---

## 6. Error handling (CRM behaviour)

| Design Module response | CRM UI |
|------------------------|--------|
| 200 OK | Approve succeeds silently |
| 4xx/5xx or timeout | Approve **succeeds in Hub** but CRM shows: *"Cancellation approved in CRM, but Design Module refund sync failed: …"* |

Fix Design Module and **re-trigger refund manually** (admin tool) or Hub retry — document internal ops.

---

## 7. Environment (match CRM)

| Variable | CRM | Design Module |
|----------|-----|---------------|
| `DESIGN_MODULE_URL` | Points to your server | Your deploy URL |
| `HUB_SYNC_API_KEY` | Sent as `x-api-key` | Must validate same secret |
| `BASE_URL` / Hub | Payment proof fetch | Allow Hub origin |

---

## 8. QA checklist

1. **Full deal refund** — paid ₹99,018 → approve cancel → refund ₹99,018 recorded  
2. **Buffer deal** — shortfall ₹1,000 not refunded (only customer paid amount)  
3. **Extra overpay** — refund splits 10% + extra correctly  
4. **Partial payments scope** — only selected payment ids refunded  
5. **Idempotent** — second approve returns same `refundId`, no double payout  
6. **Missing API** — CRM shows designSyncError (endpoint 404)

---

## 9. Related CRM docs

- Convert + buffer sync: `docs/DESIGN_MODULE_BOOKING_TOKEN_FINANCE_SYNC_BACKEND_HANDOFF.md`  
- Cancel milestones (Hub): `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md`  
- CRM refund wiring: `lib/design-module-hub-sync.ts` → `syncRefundToDesignModule()`

---

## 10. One-line summary for Design Module team

**Build `POST /api/hub/booking-token/finance-refund-sync` — accept CRM payload on cancel approve, create idempotent refund record, reverse finance entries for `refundAmount` (split 10% + extra), return `refundId`.**

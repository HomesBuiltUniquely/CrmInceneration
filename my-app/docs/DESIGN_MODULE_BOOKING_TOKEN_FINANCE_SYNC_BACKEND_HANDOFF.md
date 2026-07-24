# Design Module — Booking & Token Finance Sync (Convert + Refund + Extra)

**Status:** CRM convert works · Design Module finance sync **failing** on 9.9% buffer & refund not wired  
**Audience:** Design Module backend (`DesignModulephase1` / finance sync team)  
**CRM repo:** `CrmInceneration/my-app`  
**Related CRM files:** `lib/design-module-hub-sync.ts`, `app/api/crm/booking-token/deals/[recordId]/convert/route.ts`

---

## 1. Problem (from live UI)

User converts lead at **9.9% buffer** (paid ≥ 9.9% but **not** full 10%). CRM shows:

> **Booking converted in CRM, but Design Module finance sync failed: Full 10% must be received before finance sync.**

| Field | Example (`test-lead -for-design`) |
|-------|-------------------------------------|
| Quote / deal value | ₹10,00,180 |
| 10% target | ₹1,00,018 |
| 9.9% buffer min | ₹99,018 |
| Paid | ₹99,018 |
| Remaining toward 10% | ₹1,000 |
| CRM convert | ✅ Allowed (9.9% buffer) |
| Design Module sync | ❌ Blocked |

**Refund:** Manager **Approve cancellation** should trigger finance refund in Design Module — **no CRM → Design Module refund call exists today** (Hub doc only; not implemented end-to-end).

---

## 2. Current flow (CRM → Design Module)

```
Sales clicks Convert Booking
  → POST Hub /v1/booking-token/deals/{recordId}/convert     (CRM booking confirmed)
  → CRM BFF loads payment history
  → CRM BFF validates remainingAmount === 0   ← FAILS on 9.9% buffer
  → POST Design Module convert sync (never reached if validation fails)
  → FE shows designSyncError on convert modal
```

**Design Module endpoints CRM tries (in order):**

| # | Method | Path |
|---|--------|------|
| 1 | POST | `{DESIGN_MODULE_URL}/api/hub/crm-lead/convert-booking` |
| 2 | POST | `{DESIGN_MODULE_URL}/api/hub/booking-token/finance-10p-sync` |

Auth header: `x-api-key: {HUB_SYNC_API_KEY}`  
Default Design Module URL: `http://localhost:3001` (env `DESIGN_MODULE_URL`)

---

## 3. Root cause (why sync fails today)

### A. CRM BFF gate (blocks before Design Module is called)

File: `lib/design-module-hub-sync.ts`

```typescript
if ((paymentHistory.remainingAmount ?? 0) > 0) {
  throw new Error("Full 10% must be received before finance sync.");
}
```

This rejects **all** converts where 10% shortfall remains — including valid **9.9% buffer** converts.

**CRM will relax this gate** once Design Module accepts buffer payload (§6). Design Module must implement buffer + shortfall handling first or in parallel.

### B. Payload missing buffer & extra fields

`buildDesignModuleConvertPayload()` sends quote, tenPercent, amountReceived, payment history — but **does not** send:

| Missing field | Purpose |
|---------------|---------|
| `remainingAmount` | Shortfall still due toward 10% |
| `extraAmountReceived` | Customer paid above 10% (Finance bucket) |
| `totalAmountReceived` | Full customer paid (toward 10% + extra) |
| `bookingApprovalMode` | `FULL_10` \| `BUFFER_9_9` |
| `bufferApplied` | true when convert via 9.9% |
| `bufferThresholdAmount` | min paid to convert (round(quote × 0.099)) |
| `shortfallAmount` | same as remaining toward 10% when buffer |
| `financeBufferNote` | human note for Finance team |
| `history[].extraAmount` | per-payment extra portion |

### C. Refund not integrated

| Step | Today |
|------|--------|
| Manager approves cancel (`POST .../cancel/approve`) | Hub only — CRM BFF proxy, **no Design Module call** |
| Design Module refund API | **Not called from CRM** |
| Expected product rule | Approve cancel → **Refund Processed** milestone + **finance refund sync** |

---

## 4. Current payload (what CRM sends on full 10% success)

```json
{
  "bookingTokenRecordId": "c71bb3e6-…",
  "paymentHistoryId": "…",
  "leadType": "formlead",
  "leadId": 12345,
  "leadIdentifier": "AL-EDHTFUX2DN",
  "customerName": "test-lead -for-design",
  "projectName": "test-lead -for-design",
  "bookingDate": "2026-07-24",
  "quoteAmount": 1000180,
  "tenPercentAmount": 100018,
  "amountReceived": 99018,
  "paymentKind": "TOKEN",
  "paymentHistory": [
    {
      "id": "…",
      "sequence": 1,
      "amount": 99018,
      "cumulativeReceived": 99018,
      "remainingAfter": 1000,
      "paymentKind": "TOKEN",
      "source": "booking_done",
      "notes": "Initial payment from Booking Done",
      "createdAt": "2026-07-24T…",
      "financeReviewStatus": "NOT_READY",
      "proofs": [{ "id": "…", "contentPath": "/v1/booking-token/deals/…/payment-proofs/…/content" }]
    }
  ],
  "hubProofBaseUrl": "https://hows.hubinterior.com",
  "experience": { "quoteId": "71438", "quoteLink": "…", "quoteVersionLabel": "…" },
  "decision": { "finalBudget": 1000180, "expectedTimeline": null, "decisionMaker": null },
  "bookingDone": {
    "quoteId": "71438",
    "quoteAmount": 1000180,
    "tenPercentAmount": 100018,
    "amountReceived": 99018,
    "bookingDate": "2026-07-24",
    "paymentKind": "TOKEN"
  }
}
```

**Note:** `remainingAfter: 1000` is already in history — Design Module can see shortfall but CRM never calls sync when `remainingAmount > 0`.

---

## 5. Required payload (Design Module should accept)

### 5.1 Convert — full 10%

Same as today + optional extra fields:

```json
{
  "bookingApprovalMode": "FULL_10",
  "bufferApplied": false,
  "remainingAmount": 0,
  "extraAmountReceived": 5000,
  "totalAmountReceived": 105018
}
```

### 5.2 Convert — 9.9% buffer (NEW — must support)

```json
{
  "bookingApprovalMode": "BUFFER_9_9",
  "bufferApplied": true,
  "bufferThresholdAmount": 99018,
  "quoteAmount": 1000180,
  "tenPercentAmount": 100018,
  "amountReceived": 99018,
  "remainingAmount": 1000,
  "shortfallAmount": 1000,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99018,
  "financeBufferNote": "Booking allowed from 9.9% buffer. ₹1,000 still due toward 10% for Finance."
}
```

**Design Module Finance rules:**

| Mode | Accept sync? | Finance action |
|------|--------------|----------------|
| `FULL_10` | Yes | Record 10% received; route `extraAmountReceived` to extra/finance ledger |
| `BUFFER_9_9` | **Yes** | Record booking confirmed at buffer; create **open shortfall** = `remainingAmount` for Finance to collect later |
| Below 9.9% | No | Reject — CRM should not call |

### 5.3 Per-payment extra

When customer overpays in Pay action:

```json
{
  "paymentHistory": [
    {
      "amount": 60000,
      "extraAmount": 9982,
      "cumulativeReceived": 60000,
      "remainingAfter": 40018
    }
  ],
  "extraAmountReceived": 9982,
  "totalAmountReceived": 109982
}
```

- `amount` = full payment customer made  
- `extraAmount` = portion above remaining 10% target (Hub field)  
- Finance should credit 10% portion toward milestone and **extra** toward separate Finance balance

---

## 6. Design Module API changes needed

### 6.1 Update convert sync (existing endpoints)

**Paths (keep for backward compat):**

- `POST /api/hub/crm-lead/convert-booking`
- `POST /api/hub/booking-token/finance-10p-sync`

**Validation change:**

| Old | New |
|-----|-----|
| Reject if `amountReceived < tenPercentAmount` | Accept if `bookingApprovalMode === BUFFER_9_9` AND `amountReceived >= bufferThresholdAmount` |
| — | Accept if `bookingApprovalMode === FULL_10` AND `amountReceived >= tenPercentAmount` |

**Response (200):**

```json
{
  "ok": true,
  "designLeadId": 456,
  "bookingTokenRecordId": "c71bb3e6-…",
  "financeSyncMode": "BUFFER_9_9",
  "shortfallRecorded": 1000
}
```

**Response (400) — examples:**

```json
{ "message": "Paid amount below 9.9% buffer threshold" }
{ "message": "Missing bookingApprovalMode" }
```

### 6.2 New — refund sync (cancellation approve)

**Suggested endpoint:**

```
POST /api/hub/booking-token/finance-refund-sync
```

**When:** Hub (or CRM BFF after Hub approve) fires on `POST .../cancel/approve`.

**Payload:**

```json
{
  "bookingTokenRecordId": "…",
  "leadType": "formlead",
  "leadId": 12345,
  "leadIdentifier": "AL-EDHTFUX2DN",
  "customerName": "test-lead -for-design",
  "quoteAmount": 1000180,
  "amountReceived": 99018,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99018,
  "cancellationReason": "Customer changed plans",
  "cancelledAt": "2026-07-24T…",
  "cancellationApprovedAt": "2026-07-24T…",
  "cancellationApprovedBy": "Manager Name",
  "refundScope": "deal",
  "paymentHistory": [ "… same shape as convert …" ],
  "hubProofBaseUrl": "https://hows.hubinterior.com"
}
```

**Design Module action:**

1. Create refund task / reverse finance entries for `totalAmountReceived` (or selected payments if partial cancel).
2. If `extraAmountReceived > 0`, refund extra portion separately if already routed to Finance.
3. Return `{ "ok": true, "refundId": "…", "refundAmount": 99018 }`.

**Who calls it (after Design Module builds API):**

| Option | Owner |
|--------|--------|
| A (preferred) | **Hub** on `cancel/approve` — same pattern as milestone update |
| B | **CRM BFF** after approve proxy succeeds — mirror convert sync in `design-module-hub-sync.ts` |

Today: **neither A nor B is wired** → refund process incomplete.

---

## 7. CRM side (updated)

| Item | File | Status |
|------|------|--------|
| Allow 9.9% buffer sync (not only full 10%) | `lib/design-module-hub-sync.ts` | ✅ Done — `resolveFinanceSyncEligibility()` |
| Buffer + extra fields in payload | `buildDesignModuleConvertPayload()` | ✅ Done |
| Refund sync helper | `lib/design-module-hub-sync.ts` | ⏳ Pending — needs Design Module refund API |
| Convert modal error | `lib/booking-done-api.ts` | Surfaces `designSyncError` from BFF |

**Deploy CRM (Vercel/local) after pull** — old BFF still blocked with “Full 10% must be received” before this change.

---

## 8. Environment

| CRM env var | Purpose |
|-------------|---------|
| `DESIGN_MODULE_URL` | Design Module origin (e.g. `http://localhost:3001` or production URL) |
| `HUB_SYNC_API_KEY` | `x-api-key` for Hub ingest routes on Design Module |
| `BASE_URL` / `HUB_API_BASE_URL` | Payment proof URLs (`hubProofBaseUrl` in payload) |

Design Module must expose routes on the same host configured in CRM `DESIGN_MODULE_URL`.

---

## 9. QA checklist (Design Module)

### Convert — 9.9% buffer

1. Quote ₹10,00,180 · paid ₹99,018 · remaining ₹1,000.  
2. CRM convert with payload §5.2.  
3. **200 OK** — design lead updated; shortfall ₹1,000 recorded for Finance.  
4. No error “Full 10% must be received”.

### Convert — full 10% + extra

1. 10% target ₹1,00,018 · customer pays ₹1,05,000.  
2. `extraAmountReceived = 4982`, `remainingAmount = 0`.  
3. Finance shows 10% complete + extra ₹4,982.

### Refund — cancel approve

1. Deal with ₹99,018 received → cancel approved.  
2. Refund sync called with §6.2 payload.  
3. Refund record created for ₹99,018 (or correct partial amount).  
4. CRM milestone **Refund Processed** (Hub — separate handoff).

---

## 10. Example from screenshot (repro)

- **Customer:** test-lead -for-design  
- **Quote:** 71438 · AL-EDHTFUX2DN  
- **Payment 1:** ₹99,018 · TOKEN · Booking Done  
- **Error:** `Full 10% must be received before finance sync.`  
- **Fix owner:** Design Module accept `BUFFER_9_9` + CRM send shortfall fields (§5.2, §6.1)

---

## 11. Related CRM docs

- 9.9% buffer (CRM): `lib/booking-token-buffer.ts`  
- Extra / overpay (CRM): `lib/booking-payment-overpay.ts`  
- Cancel milestones (Hub): `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md`  
- Payment history (Hub): `docs/BOOKING_PAYMENT_HISTORY_BACKEND_HANDOFF.md`

---

## 12. One-line ask for Design Module team

**Support convert finance sync at 9.9% buffer with `remainingAmount` shortfall + `extraAmountReceived`, and add a refund sync API for cancellation approve — CRM already calls convert endpoints but blocks buffer today until you accept the new payload.**

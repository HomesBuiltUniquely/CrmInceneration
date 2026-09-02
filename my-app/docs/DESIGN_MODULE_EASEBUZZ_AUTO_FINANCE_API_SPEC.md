# Design Module — Easebuzz Auto Finance on Convert (API Spec)

**Status:** Design Module **implemented** (existing tables only — no new DB table)  
**Scope:** Convert → 10% finance sync · Easebuzz auto-approve · Finance Manual + Auto approved sections  
**Caller:** CRM BFF (`CrmInceneration/my-app`)  
**CRM source files:** `lib/design-module-hub-sync.ts`, `app/api/crm/booking-token/deals/[recordId]/convert/route.ts`

---

## 1. Summary

When sales **Convert to Booking** in CRM, the BFF POSTs payment history to Design Module. Design Module must:

1. Accept **full 10%** and **9.9% buffer** converts.
2. **Auto-approve** finance (complete 10% collection + approval tasks, stage → `10-20%`) when qualifying payment is **Easebuzz + Hub `APPROVED`**.
3. Route **offline / mixed / pending / rejected** payments to the **Manual 10% queue**.
4. Show auto-approved deals in a separate **Auto approved (Easebuzz)** section — **Finance stays CC'd** (visibility, no approve click).
5. Be **idempotent** on re-sync (same `bookingTokenRecordId`).

---

## 2. End-to-end flow

```
Sales clicks Convert (CRM)
  → Hub POST /v1/booking-token/deals/{recordId}/convert
  → CRM BFF loads payment history from Hub
  → CRM BFF POST Design Module convert sync (this spec)
  → Design Module:
       • Evaluate auto-finance eligibility (§5)
       • AUTO  → complete tasks, stage 10-20%, Finance "Auto approved" + CC
       • MANUAL → Finance manual queue (upload proof + approve)
  → CRM returns designLeadId or designSyncError
```

**Retry:** CRM exposes manual re-sync:

```http
POST /api/crm/design-module/crm-lead/convert-booking
Content-Type: application/json

{ "recordId": "<bookingTokenRecordId>" }
```

Design Module must treat duplicate convert sync as **update**, not duplicate tasks.

---

## 3. Authentication

All Hub ingest routes use the same key CRM already sends:

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `x-api-key` | `{HUB_SYNC_API_KEY}` — shared secret (CRM env) |

**401** if key missing/invalid.

---

## 4. Inbound APIs (Design Module must implement)

CRM tries endpoints **in order**; implement **both** for backward compatibility.

| Priority | Method | Path | Purpose |
|----------|--------|------|---------|
| 1 | `POST` | `/api/hub/crm-lead/convert-booking` | Primary convert + finance sync |
| 2 | `POST` | `/api/hub/booking-token/finance-10p-sync` | Legacy alias — same handler as above |

### 4.1 Convert booking sync

```http
POST /api/hub/crm-lead/convert-booking
Content-Type: application/json
x-api-key: <HUB_SYNC_API_KEY>
```

#### Request body — full schema

```typescript
type ConvertBookingSyncRequest = {
  bookingTokenRecordId: string;       // UUID — idempotency key
  paymentHistoryId?: string | null;   // completion / finance entry id
  leadType: string;                   // e.g. "formlead"
  leadId: number;
  leadIdentifier?: string | null;     // e.g. "AL-EDHTFUX2DN"
  customerName?: string | null;
  projectName?: string | null;
  bookingDate?: string | null;        // YYYY-MM-DD

  quoteAmount: number;
  tenPercentAmount: number;
  amountReceived: number;
  remainingAmount: number;
  extraAmountReceived?: number;
  totalAmountReceived?: number;

  bookingApprovalMode: "FULL_10" | "BUFFER_9_9";
  bufferApplied: boolean;
  bufferThresholdAmount?: number;
  bufferRate?: number;                // 0.099
  shortfallAmount?: number;
  financeBufferNote?: string | null;
  paymentKind?: string | null;        // TOKEN | FULL_10%

  paymentHistory: PaymentHistoryEntry[];
  hubProofBaseUrl: string;            // Hub origin for proof fetch

  experience?: {
    quoteId?: string | number | null;
    quoteLink?: string | null;
    quoteVersionLabel?: string | null;
  };
  decision?: {
    finalBudget?: number | null;
    expectedTimeline?: string | null;
    decisionMaker?: string | null;
  };
  bookingDone?: {
    quoteId?: string | number | null;
    quoteAmount?: number;
    tenPercentAmount?: number;
    amountReceived?: number;
    remainingAmount?: number;
    extraAmountReceived?: number;
    totalAmountReceived?: number;
    bookingApprovalMode?: "FULL_10" | "BUFFER_9_9";
    bufferApplied?: boolean;
    bufferThresholdAmount?: number;
    shortfallAmount?: number;
    bookingDate?: string | null;
    paymentKind?: string | null;
  };

  // Optional — CRM may add in a follow-up PR for clearer DM logic
  autoFinanceEligible?: boolean;
  completionPaymentSource?: "EASEBUZZ" | "OFFLINE" | "MIXED" | null;
};

type PaymentHistoryEntry = {
  id: string;
  sequence: number;
  amount: number;
  extraAmount?: number;
  cumulativeReceived: number;
  remainingAfter: number;
  paymentKind?: string;
  source?: string;                    // booking_done | pay_action | EASEBUZZ | ...
  paymentChannel?: string;            // ONLINE | OFFLINE — may be absent in v1 payload
  paymentMethod?: string;             // UPI | CARD | CASH | ...
  gatewayPaymentId?: string | null;
  paymentAttemptId?: string | null;
  notes?: string | null;
  createdAt: string;                  // ISO-8601
  financeReviewStatus?: "NOT_READY" | "PENDING" | "APPROVED" | "REJECTED";
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
  proofs?: Array<{
    id: string;
    originalFileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedAt?: string;
    contentPath: string;              // relative Hub path or full viewUrl
  }>;
};
```

#### Easebuzz detection (Design Module)

Treat payment as **online / Easebuzz** when **either**:

```typescript
source.toUpperCase() === "EASEBUZZ"
// OR
paymentChannel?.toUpperCase() === "ONLINE"
```

If `paymentChannel` is missing (current CRM payload), infer from `source === "EASEBUZZ"` only.

---

### 4.2 Example requests

#### A. Easebuzz — full 10% — auto finance

```json
{
  "bookingTokenRecordId": "c71bb3e6-a1b2-4c5d-9e8f-111111111111",
  "paymentHistoryId": "pay-eb-001",
  "leadType": "formlead",
  "leadId": 12345,
  "leadIdentifier": "AL-EDHTFUX2DN",
  "customerName": "Rahul Sharma",
  "projectName": "Rahul Sharma",
  "bookingDate": "2026-07-24",
  "quoteAmount": 1000000,
  "tenPercentAmount": 100000,
  "amountReceived": 100000,
  "remainingAmount": 0,
  "extraAmountReceived": 0,
  "totalAmountReceived": 100000,
  "bookingApprovalMode": "FULL_10",
  "bufferApplied": false,
  "bufferThresholdAmount": 99000,
  "bufferRate": 0.099,
  "shortfallAmount": 0,
  "financeBufferNote": null,
  "paymentKind": "FULL_10%",
  "paymentHistory": [
    {
      "id": "pay-eb-001",
      "sequence": 1,
      "amount": 100000,
      "extraAmount": 0,
      "cumulativeReceived": 100000,
      "remainingAfter": 0,
      "paymentKind": "FULL_10%",
      "source": "EASEBUZZ",
      "paymentChannel": "ONLINE",
      "paymentMethod": "UPI",
      "gatewayPaymentId": "EBZ-20260724-998877",
      "notes": "Easebuzz payment link",
      "createdAt": "2026-07-24T10:15:00.000Z",
      "financeReviewStatus": "APPROVED",
      "proofs": []
    }
  ],
  "hubProofBaseUrl": "https://hows.hubinterior.com",
  "experience": {
    "quoteId": "71438",
    "quoteLink": "https://quotes.example.com/71438",
    "quoteVersionLabel": "v3"
  },
  "decision": {
    "finalBudget": 1000000,
    "expectedTimeline": "3 months",
    "decisionMaker": "Rahul Sharma"
  },
  "bookingDone": {
    "quoteId": "71438",
    "quoteAmount": 1000000,
    "tenPercentAmount": 100000,
    "amountReceived": 100000,
    "remainingAmount": 0,
    "bookingApprovalMode": "FULL_10",
    "bufferApplied": false,
    "bookingDate": "2026-07-24",
    "paymentKind": "FULL_10%"
  }
}
```

**Expected Design Module action:**

- Auto-complete task: `10% payment collection`
- Auto-complete task: `10% payment approval`
- Set project stage → **`10-20%`**
- Create Finance row in section **`AUTO_APPROVED`**
- Notify Finance (CC) — read-only, approver = `SYSTEM · Easebuzz`

---

#### B. Easebuzz — 9.9% buffer — auto finance + shortfall note

```json
{
  "bookingTokenRecordId": "c71bb3e6-b2c3-4d5e-9f0a-222222222222",
  "paymentHistoryId": "pay-eb-002",
  "leadType": "formlead",
  "leadId": 12346,
  "leadIdentifier": "AL-BUFFER99",
  "customerName": "test-lead-for-design",
  "projectName": "test-lead-for-design",
  "bookingDate": "2026-07-24",
  "quoteAmount": 1000180,
  "tenPercentAmount": 100018,
  "amountReceived": 99018,
  "remainingAmount": 1000,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99018,
  "bookingApprovalMode": "BUFFER_9_9",
  "bufferApplied": true,
  "bufferThresholdAmount": 99018,
  "bufferRate": 0.099,
  "shortfallAmount": 1000,
  "financeBufferNote": "Booking allowed from 9.9% buffer. ₹1,000 still due toward 10% for Finance.",
  "paymentKind": "TOKEN",
  "paymentHistory": [
    {
      "id": "pay-eb-002",
      "sequence": 1,
      "amount": 99018,
      "extraAmount": 0,
      "cumulativeReceived": 99018,
      "remainingAfter": 1000,
      "paymentKind": "TOKEN",
      "source": "EASEBUZZ",
      "paymentChannel": "ONLINE",
      "paymentMethod": "CARD",
      "gatewayPaymentId": "EBZ-20260724-112233",
      "createdAt": "2026-07-24T11:00:00.000Z",
      "financeReviewStatus": "APPROVED",
      "proofs": []
    }
  ],
  "hubProofBaseUrl": "https://hows.hubinterior.com",
  "bookingDone": {
    "quoteAmount": 1000180,
    "tenPercentAmount": 100018,
    "amountReceived": 99018,
    "remainingAmount": 1000,
    "bookingApprovalMode": "BUFFER_9_9",
    "bufferApplied": true,
    "shortfallAmount": 1000,
    "bookingDate": "2026-07-24",
    "paymentKind": "TOKEN"
  }
}
```

**Expected Design Module action:**

- Same auto-complete + stage `10-20%` as full 10%
- Finance row in **`AUTO_APPROVED`** with `shortfallAmount: 1000` displayed (info only — no manual approve)
- Finance CC notification includes shortfall note

---

#### C. Offline proof — manual finance queue

```json
{
  "bookingTokenRecordId": "c71bb3e6-c3d4-4e5f-a0b1-333333333333",
  "leadType": "formlead",
  "leadId": 12347,
  "leadIdentifier": "AL-OFFLINE01",
  "customerName": "Priya Offline",
  "quoteAmount": 800000,
  "tenPercentAmount": 80000,
  "amountReceived": 80000,
  "remainingAmount": 0,
  "extraAmountReceived": 0,
  "totalAmountReceived": 80000,
  "bookingApprovalMode": "FULL_10",
  "bufferApplied": false,
  "bufferThresholdAmount": 79200,
  "shortfallAmount": 0,
  "paymentHistory": [
    {
      "id": "pay-off-001",
      "sequence": 1,
      "amount": 80000,
      "cumulativeReceived": 80000,
      "remainingAfter": 0,
      "paymentKind": "FULL_10%",
      "source": "booking_done",
      "paymentChannel": "OFFLINE",
      "paymentMethod": "BANK_TRANSFER",
      "createdAt": "2026-07-24T09:00:00.000Z",
      "financeReviewStatus": "PENDING",
      "proofs": [
        {
          "id": "proof-001",
          "originalFileName": "bank-receipt.pdf",
          "mimeType": "application/pdf",
          "contentPath": "/v1/booking-token/deals/c71bb3e6-c3d4-4e5f-a0b1-333333333333/payment-proofs/proof-001/content"
        }
      ]
    }
  ],
  "hubProofBaseUrl": "https://hows.hubinterior.com"
}
```

**Expected Design Module action:**

- Create Finance row in section **`MANUAL_QUEUE`**
- Tasks **not** auto-completed — Finance uploads/reviews proof and approves manually
- Stage moves to `10-20%` **only after** Finance manual approve (existing behavior)
- Finance CC on queue item

---

#### D. Mixed payment — manual (disqualifies auto)

```json
{
  "bookingTokenRecordId": "c71bb3e6-d4e5-4f6a-b1c2-444444444444",
  "leadType": "formlead",
  "leadId": 12348,
  "quoteAmount": 1000000,
  "tenPercentAmount": 100000,
  "amountReceived": 100000,
  "remainingAmount": 0,
  "bookingApprovalMode": "FULL_10",
  "bufferApplied": false,
  "paymentHistory": [
    {
      "id": "pay-mix-001",
      "sequence": 1,
      "amount": 50000,
      "cumulativeReceived": 50000,
      "remainingAfter": 50000,
      "source": "booking_done",
      "paymentChannel": "OFFLINE",
      "financeReviewStatus": "PENDING",
      "proofs": [{ "id": "p1", "contentPath": "/v1/booking-token/deals/.../p1/content" }]
    },
    {
      "id": "pay-mix-002",
      "sequence": 2,
      "amount": 50000,
      "cumulativeReceived": 100000,
      "remainingAfter": 0,
      "source": "EASEBUZZ",
      "paymentChannel": "ONLINE",
      "financeReviewStatus": "APPROVED",
      "gatewayPaymentId": "EBZ-mix-002",
      "proofs": []
    }
  ],
  "hubProofBaseUrl": "https://hows.hubinterior.com"
}
```

**Expected:** **`MANUAL_QUEUE`** — any offline/PENDING entry in threshold-qualifying payments blocks auto.

---

### 4.3 Convert sync — success response

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "ok": true,
  "designLeadId": 456,
  "bookingTokenRecordId": "c71bb3e6-a1b2-4c5d-9e8f-111111111111",
  "financeHandlingMode": "AUTO_APPROVED",
  "financeSection": "AUTO_APPROVED",
  "financeSyncMode": "FULL_10",
  "projectStage": "10-20%",
  "tasksCompleted": [
    "10_percent_payment_collection",
    "10_percent_payment_approval"
  ],
  "shortfallRecorded": 0,
  "financeCcNotified": true,
  "idempotentReplay": false,
  "gatewayPaymentId": "EBZ-20260724-998877",
  "approvedBy": "SYSTEM · Easebuzz",
  "approvedAt": "2026-07-24T12:05:00.000Z"
}
```

#### Manual queue success response

```json
{
  "ok": true,
  "designLeadId": 457,
  "bookingTokenRecordId": "c71bb3e6-c3d4-4e5f-a0b1-333333333333",
  "financeHandlingMode": "MANUAL_QUEUE",
  "financeSection": "MANUAL_QUEUE",
  "financeSyncMode": "FULL_10",
  "projectStage": null,
  "tasksCompleted": [],
  "shortfallRecorded": 0,
  "financeCcNotified": true,
  "idempotentReplay": false,
  "financeQueueItemId": "fq-manual-001"
}
```

#### Buffer auto-approved response

```json
{
  "ok": true,
  "designLeadId": 458,
  "bookingTokenRecordId": "c71bb3e6-b2c3-4d5e-9f0a-222222222222",
  "financeHandlingMode": "AUTO_APPROVED",
  "financeSection": "AUTO_APPROVED",
  "financeSyncMode": "BUFFER_9_9",
  "projectStage": "10-20%",
  "tasksCompleted": [
    "10_percent_payment_collection",
    "10_percent_payment_approval"
  ],
  "shortfallRecorded": 1000,
  "financeCcNotified": true,
  "idempotentReplay": false,
  "approvedBy": "SYSTEM · Easebuzz"
}
```

#### Idempotent re-sync response

```json
{
  "ok": true,
  "designLeadId": 456,
  "bookingTokenRecordId": "c71bb3e6-a1b2-4c5d-9e8f-111111111111",
  "financeHandlingMode": "AUTO_APPROVED",
  "financeSection": "AUTO_APPROVED",
  "idempotentReplay": true,
  "message": "Convert sync already processed; no duplicate tasks created."
}
```

**CRM reads:** `designLeadId` (required for success). Other fields are for Design Module UI / logs.

---

### 4.4 Convert sync — error responses

| HTTP | When | Body |
|------|------|------|
| **400** | Paid below 9.9% buffer | `{ "message": "Paid amount below 9.9% buffer threshold" }` |
| **400** | Missing lead keys | `{ "message": "Missing leadType or leadId" }` |
| **400** | Invalid payload | `{ "message": "Missing bookingApprovalMode" }` |
| **401** | Bad API key | `{ "message": "Unauthorized" }` |
| **404** | Lead not found (optional) | `{ "message": "Design lead not found for leadId 12345" }` |
| **409** | Conflict (optional) | `{ "message": "Deal already converted with conflicting payment state" }` |
| **500** | Server error | `{ "message": "Internal error during finance sync" }` |

---

## 5. Auto-finance eligibility (Design Module server logic)

Auto-approve **only when ALL** are true:

| # | Rule |
|---|------|
| 1 | `bookingApprovalMode` is `FULL_10` or `BUFFER_9_9` |
| 2 | Paid threshold met (`amountReceived >= tenPercentAmount` OR buffer threshold) |
| 3 | **Completion entry** (entry with id = `paymentHistoryId`, else last history entry) is Easebuzz/online |
| 4 | Completion entry `financeReviewStatus === "APPROVED"` |
| 5 | **No disqualifier:** every payment entry that counts toward the 10%/9.9% threshold is Easebuzz + APPROVED (no offline, no PENDING, no REJECTED) |
| 6 | Not switch-offline: completion entry is not proof upload after cancelled link |
| 7 | No `REJECTED` or `NOT_READY` on any threshold-qualifying entry |

**Otherwise → `MANUAL_QUEUE`.**

### Pseudocode

```typescript
function resolveFinanceHandlingMode(body: ConvertBookingSyncRequest): "AUTO_APPROVED" | "MANUAL_QUEUE" {
  const completion = findCompletionEntry(body);
  const qualifying = body.paymentHistory.filter(e => e.amount > 0);

  if (qualifying.some(e => isOffline(e) || isPendingOrRejected(e))) {
    return "MANUAL_QUEUE";
  }
  if (!isEasebuzz(completion) || completion.financeReviewStatus !== "APPROVED") {
    return "MANUAL_QUEUE";
  }
  return "AUTO_APPROVED";
}
```

---

## 6. Finance UI — sections (Design Module internal APIs)

Design Module owns Finance dashboard. Suggested read APIs (implement in DM backend; **not called by CRM today**).

### 6.1 List manual queue

```http
GET /api/finance/booking-token/10p-queue?section=MANUAL_QUEUE&status=PENDING
Authorization: Bearer <finance-user-token>
```

**Response 200:**

```json
{
  "ok": true,
  "section": "MANUAL_QUEUE",
  "items": [
    {
      "financeQueueItemId": "fq-manual-001",
      "designLeadId": 457,
      "bookingTokenRecordId": "c71bb3e6-c3d4-...",
      "leadIdentifier": "AL-OFFLINE01",
      "customerName": "Priya Offline",
      "amountReceived": 80000,
      "tenPercentAmount": 80000,
      "bookingApprovalMode": "FULL_10",
      "financeReviewStatus": "PENDING",
      "proofCount": 1,
      "hubProofBaseUrl": "https://hows.hubinterior.com",
      "createdAt": "2026-07-24T12:00:00.000Z",
      "actions": ["VIEW_PROOFS", "APPROVE", "REJECT"]
    }
  ],
  "total": 1
}
```

### 6.2 List auto approved (Finance CC — read-only)

```http
GET /api/finance/booking-token/10p-queue?section=AUTO_APPROVED
Authorization: Bearer <finance-user-token>
```

**Response 200:**

```json
{
  "ok": true,
  "section": "AUTO_APPROVED",
  "items": [
    {
      "financeQueueItemId": "fq-auto-001",
      "designLeadId": 456,
      "bookingTokenRecordId": "c71bb3e6-a1b2-...",
      "leadIdentifier": "AL-EDHTFUX2DN",
      "customerName": "Rahul Sharma",
      "amountReceived": 100000,
      "tenPercentAmount": 100000,
      "bookingApprovalMode": "FULL_10",
      "paymentSource": "EASEBUZZ",
      "gatewayPaymentId": "EBZ-20260724-998877",
      "approvedBy": "SYSTEM · Easebuzz",
      "approvedAt": "2026-07-24T12:05:00.000Z",
      "shortfallAmount": 0,
      "projectStage": "10-20%",
      "financeCcNotified": true,
      "actions": ["VIEW_ONLY"]
    }
  ],
  "total": 1
}
```

### 6.3 Manual approve (existing — manual queue only)

```http
POST /api/finance/booking-token/10p-queue/{financeQueueItemId}/approve
Authorization: Bearer <finance-user-token>
Content-Type: application/json

{
  "notes": "Proof verified"
}
```

**Response 200:**

```json
{
  "ok": true,
  "financeQueueItemId": "fq-manual-001",
  "financeReviewStatus": "APPROVED",
  "projectStage": "10-20%",
  "tasksCompleted": [
    "10_percent_payment_collection",
    "10_percent_payment_approval"
  ]
}
```

**Note:** No approve endpoint for `AUTO_APPROVED` section — read-only audit.

### 6.4 Manual reject

```http
POST /api/finance/booking-token/10p-queue/{financeQueueItemId}/reject
Content-Type: application/json

{
  "reason": "Proof unclear — request re-upload"
}
```

**Response 200:**

```json
{
  "ok": true,
  "financeQueueItemId": "fq-manual-001",
  "financeReviewStatus": "REJECTED"
}
```

---

## 7. Data model (Design Module — existing tables only)

**No new table required.** Design Module team implemented using existing schema. The optional `finance_10p_sync_records` table from an earlier draft is **not used**.

### 7.1 Minimum storage (3 places)

| Table / field | Purpose |
|---------------|---------|
| **`lead_hub_booking_sync`** | Payment sync row per convert — stores Hub request + amounts |
| **`leads.payload`** | Finance flags for auto vs manual queue |
| **`leads.project_stage`** | `Pre 10%` → `10-20%` after auto-approve or manual approve |

### 7.2 `lead_hub_booking_sync`

| Column | What it stores |
|--------|----------------|
| `lead_id` | Design lead ID |
| `booking_token_record_id` | Hub booking token record — **idempotency key** (unique) |
| `payment_history_id` | Which payment entry this sync refers to |
| `payment_payload` | Full Hub convert request JSON (`sync_payload`) |

**Also in `payment_payload` (JSON):**

| Field | Value |
|-------|-------|
| `finance_sync_mode` | `FULL_10` \| `BUFFER_9_9` |
| `buffer_applied` | `true` when 9.9% buffer convert |
| `shortfall_recorded` / `remaining_amount` | ₹ still due toward 10% |
| `amount_received`, `ten_percent_amount`, etc. | Payment breakdown |

### 7.3 `leads.payload` — finance flags

| Payload key | Example | Purpose |
|-------------|---------|---------|
| `crm_finance_handling_mode` | `AUTO_APPROVED` \| `MANUAL_QUEUE` | Drives Finance UI section |
| `crm_booking_finance_auto_approved` | `true` \| `false` | Quick filter for auto-approved leads |
| `crm_booking_finance_approved_by` | `SYSTEM · Easebuzz` \| user id \| `null` | Who approved (null = pending manual) |
| `crm_booking_finance_approved` | `true` | Set after auto or manual approve — used for idempotent re-sync |
| `finance_cc_notified` | `true` (optional) | Finance CC sent; can infer `true` when `AUTO_APPROVED` |

### 7.4 `leads.project_stage`

| After convert | Stage |
|---------------|-------|
| Manual queue (pending finance) | Stays **`Pre 10%`** until Finance approves |
| Auto-approved (Easebuzz) | **`10-20%`** immediately |
| Manual approve completed | **`10-20%`** |

### 7.5 Field mapping (spec → existing DB)

| API / logical field | Stored in |
|---------------------|-----------|
| `lead_id`, `booking_token_record_id`, `payment_history_id` | `lead_hub_booking_sync` |
| `finance_sync_mode`, buffer, shortfall, amounts | `lead_hub_booking_sync.payment_payload` |
| `finance_handling_mode`, `finance_section` | `leads.payload` → `crm_finance_handling_mode` |
| `approved_by`, auto flag | `leads.payload` → `crm_booking_finance_approved_by`, `crm_booking_finance_auto_approved` |
| `project_stage` | `leads.project_stage` |
| `finance_cc_notified` | `leads.payload.finance_cc_notified` or inferred from auto-approve |
| `sync_payload` | `lead_hub_booking_sync.payment_payload` |
| `response_payload` | Rebuilt from sync row + lead payload on re-sync (not stored separately) |

### 7.6 Idempotent re-sync (no duplicate auto-approve)

```
Idempotent key = {bookingTokenRecordId}:{paymentHistoryId}

On POST /api/hub/crm-lead/convert-booking:
  1. SELECT lead_hub_booking_sync WHERE booking_token_record_id = :id
  2. IF row exists AND leads.payload.crm_booking_finance_approved = true
       → return 200 { idempotentReplay: true } — do NOT re-run tasks
  3. ELSE upsert lead_hub_booking_sync + update leads.payload + project_stage
```

### 7.7 Finance CC / notifications

On both `AUTO_APPROVED` and `MANUAL_QUEUE`:

- Notification to Finance team / role
- Lead activity entry: `"Finance CC · 10% sync on convert"`
- Auto path: `"Auto approved via Easebuzz — no action required"`

---

## 8. Validation rules (convert sync)

| Check | Reject if |
|-------|-----------|
| Minimum paid | `amountReceived < bufferThresholdAmount` (below 9.9%) |
| Lead identity | Missing `leadType` or `leadId` |
| Idempotency | Existing `lead_hub_booking_sync` row + `crm_booking_finance_approved` in `leads.payload` → return 200 with `idempotentReplay: true` |
| Proof URLs | Resolve via `{hubProofBaseUrl}{contentPath}` for manual queue |

---

## 9. CRM ↔ Design Module contract summary

| Direction | Endpoint | When |
|-----------|----------|------|
| CRM → DM | `POST /api/hub/crm-lead/convert-booking` | Every Convert to Booking |
| CRM → DM | `POST /api/hub/booking-token/finance-10p-sync` | Fallback if primary 404 |
| CRM → DM (retry) | `POST /api/crm/design-module/crm-lead/convert-booking` | Manual re-sync from CRM |
| DM internal | `GET /api/finance/booking-token/10p-queue` | Finance dashboard |
| DM internal | `POST .../approve` / `.../reject` | Manual queue only |

---

## 10. Environment

| Variable (CRM) | Purpose |
|----------------|---------|
| `DESIGN_MODULE_URL` | Base URL for DM APIs |
| `HUB_SYNC_API_KEY` | `x-api-key` on inbound sync |
| `HUB_API_BASE_URL` | Proof base URL in payload |

Design Module must register the same `HUB_SYNC_API_KEY` for ingest routes.

---

## 11. QA checklist

| # | Scenario | Expected `financeHandlingMode` | Finance section |
|---|----------|-------------------------------|-----------------|
| 1 | Full 10% Easebuzz APPROVED | `AUTO_APPROVED` | Auto approved + CC |
| 2 | 9.9% buffer Easebuzz APPROVED | `AUTO_APPROVED` | Auto approved + shortfall shown |
| 3 | Offline PENDING | `MANUAL_QUEUE` | Manual queue |
| 4 | Mixed offline + Easebuzz | `MANUAL_QUEUE` | Manual queue |
| 5 | Easebuzz NOT_READY | `MANUAL_QUEUE` | Manual → retry after Hub APPROVED |
| 6 | Easebuzz REJECTED | `MANUAL_QUEUE` | Manual queue |
| 7 | Re-sync same recordId | 200, `idempotentReplay: true` | No duplicate tasks |
| 8 | Extra above 10% | `AUTO_APPROVED` if Easebuzz | Auto approved shows extra amount |
| 9 | Hub convert OK, DM 500 | CRM shows `designSyncError` | Retry sync fixes state |

---

## 12. Related docs

- Buffer + convert payload (existing): `docs/DESIGN_MODULE_BOOKING_TOKEN_FINANCE_SYNC_BACKEND_HANDOFF.md`
- Refund sync (separate flow): `docs/DESIGN_MODULE_REFUND_PROCESS_IMPLEMENTATION.md`
- CRM payload builder: `lib/design-module-hub-sync.ts`

---

## 13. Implementation status

| Layer | Status |
|-------|--------|
| **Design Module** | ✅ Implemented — uses `lead_hub_booking_sync` + `leads.payload` + `leads.project_stage` only |
| **CRM BFF** | ✅ Already calls convert sync on Convert (`lib/design-module-hub-sync.ts`) |
| **E2E QA** | Run §11 checklist across Easebuzz / offline / buffer / re-sync |

**One-line summary:** On convert sync, Design Module writes payment data to `lead_hub_booking_sync`, finance mode to `leads.payload`, stage to `leads.project_stage` — auto-approves Easebuzz + APPROVED to `10-20%` (Finance Auto approved + CC), else Manual queue — idempotent on `booking_token_record_id`.

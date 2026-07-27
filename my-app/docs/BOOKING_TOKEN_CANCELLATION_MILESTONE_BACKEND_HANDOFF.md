# Booking & Token Cancellation Milestones — Backend Handoff

**Status:** Hub backend implemented · Frontend wired to Hub APIs (localStorage interim removed)  
**Audience:** Hub / Spring backend (`Project-ERP`) + CRM FE  
**Frontend repo:** `CrmInceneration/my-app`  
**Related UI:** Booking & Token deals table, Lead detail **Restore / View / Send again**, Activity History tab **Booking & Token**

---

## 1. Summary

Product rules agreed with CRM:

| Event | Lead milestone (auto) | Manual Complete Task? |
|-------|----------------------|------------------------|
| Token payment (&lt;10%) | Closed → Closed Won → **Token Done** | No |
| Full 10% / Booking Done handoff | **Booking Done (Booking)** | No |
| 9.9% convert to booking | **Booking Done (Booking)** | No |
| Cancel apply (within 24h of handoff) | Closed → **Closed Lost** → **Project Cancelled After Token/Booking** + `resone` | No |
| Manager **approve** cancel | **Refund Processed** + finance refund | No |
| Manager **reject** cancel | Stays on Cancelled After | No |
| **Restore** (withdraw cancel) | Back to **Token Done** / **Booking Done** | No |
| 2nd reject OR attempts exhausted | Auto-restore Token/Booking Done | No |

**No** substage named “Cancellation Pending” — pending manager review uses **Project Cancelled After Token/Booking**.

### Lead detail buttons (when on Cancelled After)

| Button | When visible |
|--------|----------------|
| **View** | Cancel applied — B&T status, deal snapshot, history |
| **Restore** | Manager has **not** approved yet (pending or rejected) |
| **Send again to manager** | After manager **reject** only; within **24h** of request; max **2** attempts total |

After **Refund Processed**: no cancel action bar.

### Activity History

New filter pill **Booking & Token** — shown **only when** the lead has B&T activity rows. Position: **to the right of Updates**.

Events to persist: token done, booking done, convert, cancel request, approve, reject, restore, refund, send again.

---

## 2. What frontend implemented (today)

| Area | File(s) | Behaviour |
|------|---------|-----------|
| Hide auto substages from Complete Task | `lib/auto-managed-milestone-substages.ts`, `CompleteTaskModal.tsx` | Drops Token/Booking Done, Cancelled After, Refund Processed from feedback dropdown |
| Milestone on cancel / approve / reject / restore | `lib/cancellation-milestone.ts`, `DealsTable.tsx`, `BookingTokenCancellationBar.tsx` | `PUT` lead detail via existing BFF; interim state in `localStorage` key `crm-bt-cancellation:{leadType}:{leadId}` |
| B&T activity tab | `lib/booking-token-activity.ts`, `ActivityTimeline.tsx`, `ActivityHistoryWithConnector.tsx` | Interim audit in `localStorage` `crm-bt-activity:{leadType}:{leadId}` merged with Hub activities |
| Resubmit BFF | `POST /api/crm/booking-token/deals/{id}/cancel/resubmit` | Proxies to Hub (see §4.4) |

**Important:** Interim storage is **per browser** until Hub owns cancellation state + activity type. Backend must replace it.

---

## 3. Database (recommended)

### 3.1 Lead extension (all CRM lead types)

| Column | Type | Notes |
|--------|------|-------|
| `bt_cancellation_deal_id` | VARCHAR | Active B&T deal id |
| `bt_cancellation_listing_type` | VARCHAR | `token` \| `booking` |
| `bt_previous_milestone_substage` | VARCHAR | Token Done \| Booking Done (Booking) |
| `bt_cancellation_attempt_count` | INT | 1–2 |
| `bt_cancellation_requested_at` | TIMESTAMPTZ | Last request time (UTC) |
| `bt_cancellation_last_reject_at` | TIMESTAMPTZ | NULL if never rejected |
| `bt_cancellation_approval_status` | VARCHAR | `PENDING` \| `REJECTED` \| `APPROVED` \| `NONE` |
| `bt_cancellation_reason` | TEXT | Customer/sales reason (`resone` mirror) |
| `bt_cancellation_reject_reason` | TEXT | Manager reject reason |

Return these on **list + detail** JSON so lead detail works across users/devices.

Optional JSON column `bt_cancellation_history[]` for audit (attempt, status, actor, at, reason).

### 3.2 Booking token deal (existing table)

Ensure list/detail exposes:

- `cancellationApprovalStatus` — `PENDING` \| `REJECTED` \| `APPROVED`
- `cancellationRequestedAt`, `cancellationReason`
- `cancellationAttemptCount` (or derive from history)

---

## 4. Hub API changes

### 4.1 `POST /v1/booking-token/deals/{id}/cancel` (deal scope)

**On successful full-deal cancel:**

1. Set deal `listingType=cancel`, `cancellationApprovalStatus=PENDING`
2. Update linked lead milestone:
   - `milestoneStage=Closed`, `milestoneStageCategory=Closed Lost` (pipeline catalog — not Closed Won)
   - `milestoneSubStage=Project Cancelled After Token` **or** `Project Cancelled After Booking` (from prior listing type)
   - Set `resone` = cancel reason
3. Store `bt_previous_milestone_substage` before overwrite
4. Set `bt_cancellation_attempt_count=1`, `bt_cancellation_requested_at=now()`
5. Append activity `activityType=BOOKING_TOKEN`, event `cancel_requested`

**Do not** leave lead on Token/Booking Done while cancel is pending.

### 4.2 `POST .../cancel/approve`

1. Set deal `cancellationApprovalStatus=APPROVED`
2. Lead milestone → **Refund Processed** + keep `resone`
3. Trigger **finance refund** (same integration as convert-to-booking / design sync)
4. Clear cancellation pending fields on lead
5. Activity `BOOKING_TOKEN` / `refund_processed`

### 4.3 `POST .../cancel/reject`

Body: `{ "reason": "..." }`

1. Set deal `cancellationApprovalStatus=REJECTED`
2. Lead stays on **Project Cancelled After Token/Booking**
3. Set `bt_cancellation_last_reject_at`, store reject reason
4. If `bt_cancellation_attempt_count >= 2` → **auto-restore** lead to `bt_previous_milestone_substage`, clear cancel fields, revert deal listing to token/booking as appropriate
5. Activity `BOOKING_TOKEN` / `cancel_rejected`

### 4.4 `POST .../cancel/resubmit` (new)

Used by lead detail **Send again to manager** (2nd attempt).

1. Require current status `REJECTED` and `attempt_count < 2`
2. Set `cancellationApprovalStatus=PENDING`, increment attempt count, refresh `cancellationRequestedAt`
3. Activity `BOOKING_TOKEN` / `send_again`

Frontend BFF: `POST /api/crm/booking-token/deals/{recordId}/cancel/resubmit`

### 4.5 Restore (new)

`POST /v1/leads/{leadType}/{leadId}/booking-token/cancellation/restore`

Or include in existing lead `PUT` when body contains `{ "restoreBookingTokenCancellation": true }`.

1. Only when approval ≠ `APPROVED` and lead on Cancelled After substage
2. Restore milestone to saved previous substage (Token Done / Booking Done)
3. Clear `resone` (or set restore note)
4. Revert deal from cancel pending to token/booking bucket
5. Clear cancellation fields
6. Activity `BOOKING_TOKEN` / `restore`

### 4.6 Booking Done handoff & convert

| Trigger | Milestone | Activity |
|---------|-----------|----------|
| `POST` booking-done (&lt;10%) | Token Done | `BOOKING_TOKEN` / `token_done` |
| `POST` booking-done (≥10%) | Booking Done (Booking) | `booking_done` |
| `POST .../convert` (9.9%) | Booking Done (Booking) | `convert_to_booking` |

Hub should perform milestone updates **server-side** (frontend currently `PUT`s as interim).

---

## 5. Activity API

Add activity type:

```json
{
  "activityType": "BOOKING_TOKEN",
  "description": "Cancellation requested — Project Cancelled After Booking",
  "note": "Customer changed plans",
  "metadata": {
    "event": "cancel_requested",
    "dealId": "123",
    "listingType": "booking"
  }
}
```

Frontend maps `BOOKING_TOKEN` → UI filter **Booking & Token**. Until Hub writes these, FE uses local audit rows.

`GET /v1/leads/{type}/{id}/activities` should return them like other types.

---

## 6. Complete Task / pipeline catalog

These substages must **not** appear in sales Complete Task feedback options (auto-only):

- Booking Done (Booking)
- Token Done
- Project Cancelled After Token
- Project Cancelled After Booking
- Refund Processed

They remain in pipeline reporting / filters as today.

---

## 7. Insight / counts (optional)

Leads on **Project Cancelled After** should not count as active Token/Booking Done in B&T dashboards once milestone is updated (milestone is source of truth).

---

## 8. Frontend ↔ Hub checklist

- [ ] Cancel deal scope updates lead milestone + `resone` + pending fields
- [ ] Approve triggers Refund Processed + finance refund
- [ ] Reject keeps Cancelled After; 2nd reject auto-restores
- [ ] Resubmit endpoint for send-again (attempt 2)
- [ ] Restore endpoint
- [ ] `BOOKING_TOKEN` activities on all B&T events
- [ ] Lead list/detail returns cancellation extension fields
- [ ] Remove need for FE `localStorage` (`crm-bt-cancellation`, `crm-bt-activity`)

---

## 9. Test scenarios

1. **Token handoff** → milestone Token Done; activity tab shows Booking & Token with token event.
2. **Cancel within 24h** → lead Cancelled After Token; bar shows View + Restore; deal PENDING.
3. **Manager reject** → Send again visible (within 24h); Restore still visible.
4. **Send again** → attempt 2; second reject → auto-restore Token Done.
5. **Manager approve** → Refund Processed; no action bar; finance refund fired.
6. **Restore before approve** → back to Booking/Token Done; cancel fields cleared.
7. **Complete Task dropdown** → none of the five auto substages listed.

---

## 10. Frontend files touched

- `lib/auto-managed-milestone-substages.ts`
- `lib/cancellation-milestone.ts`
- `lib/booking-token-activity.ts`
- `lib/closed-won-customer-milestone.ts`
- `lib/milestone-substage-map.ts`
- `lib/lead-detail-mapper.ts`
- `lib/booking-done-api.ts`
- `lib/booking-token-upstream.ts`
- `app/Components/CrmLeadDetails/CompleteTaskModal.tsx`
- `app/Components/CrmLeadDetails/ActivityTimeline.tsx`
- `app/Components/CrmLeadDetails/BookingTokenCancellationBar.tsx`
- `app/Components/CrmLeadDetails/BookingTokenCancellationViewModal.tsx`
- `app/Components/CrmLeadDetails/LeadDetailsApiClient.tsx`
- `app/Components/CrmLeadDetailsV2/ActivityHistoryWithConnector.tsx`
- `app/Components/BookingToken/components/DealsTable.tsx`
- `app/api/crm/booking-token/deals/[recordId]/cancel/resubmit/route.ts`

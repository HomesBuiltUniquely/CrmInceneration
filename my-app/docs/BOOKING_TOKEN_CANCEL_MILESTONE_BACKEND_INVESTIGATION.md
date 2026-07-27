# Backend Investigation — Cancel Pending but Lead Milestone Still Token Done

**Date:** 2026-07-24  
**Reporter:** CRM Frontend (`CrmInceneration/my-app`)  
**Environment:** `https://hows.hubinterior.com` (Hub) · FE `localhost:3000` / Vercel  
**Verdict:** **Backend (Hub) issue** — frontend does not write milestone on cancel

---

## 1. Problem (one line)

Cancel request succeeds on the **B&T deal** (`pending_cancellation` / Cancel pending), but the **CRM lead** stays **Closed → Closed Won → Token Done** instead of **Closed → Closed Lost → Project Cancelled After Token**.

---

## 2. Live example (repro)

| Field | Value |
|-------|--------|
| Customer | `test-lead -for-design` |
| Lead identifier | `AL-EDHTFUX2DN` |
| Quote | `71438` |
| B&T deal `recordId` | `9f87fa60-0e6f-485f-a8e7-0290b46245d5` (from FE URL `highlight=` param) |
| Deal received | ₹50,000 (partial 10%) |
| Assign | Shalny |

### What UI shows

| Screen | Observed |
|--------|----------|
| **Booking & Token** | Token tab · badge **Cancel pending** · Booking column **Pending cancel** |
| **Lead detail** | Stage **Closed** · Category **WON** · Sub-stage **TOKEN DONE** |
| **Lead detail bar** | No Restore / View cancellation bar (needs Cancelled After substage) |

### What product expects (same request)

| Layer | Expected immediately on `POST .../cancel` (deal scope) |
|-------|--------------------------------------------------------|
| Deal | `cancellationApprovalStatus=PENDING` (and/or `bookingStatus=pending_cancellation`) |
| Lead milestone | **Project Cancelled After Token** under **Closed Lost** |
| Lead `resone` | Cancel reason from request body |
| Lead `bt_*` | `bt_previous_milestone_substage=Token Done`, attempt count, requested at |
| Cancel API response | Includes `milestoneSubStage`, `leadType`, `leadId` |

**Pending manager approval does NOT mean keep Token Done.** There is no separate “Cancellation Pending” substage.

---

## 3. Why this is NOT frontend

| Check | Result |
|-------|--------|
| FE calls on cancel | `POST /api/crm/booking-token/deals/{recordId}/cancel` only |
| BFF | Pass-through proxy → `POST {BASE_URL}/v1/booking-token/deals/{recordId}/cancel` — **no milestone logic** |
| FE `PUT` lead on cancel | **Removed** — Hub owns milestone (`DealsTable.tsx`, `cancellation-milestone.ts`) |
| Lead detail display | Reads Hub lead detail API as-is — shows **Token Done** because Hub returns it |

**Conclusion:** FE is displaying Hub data correctly. Deal cancel partially applied; **lead milestone write missing or not persisted in Hub.**

---

## 4. Request FE sends (for Hub logs)

```http
POST /v1/booking-token/deals/9f87fa60-0e6f-485f-a8e7-0290b46245d5/cancel
Content-Type: application/json

{
  "reason": "<sales entered reason>",
  "scope": "deal"
}
```

BFF route: `my-app/app/api/crm/booking-token/deals/[recordId]/cancel/route.ts`  
Upstream: `my-app/lib/booking-token-upstream.ts` → `{BASE_URL}/v1/booking-token/deals/{id}/cancel`

---

## 5. Backend checks (do in order)

### A. Confirm cancel endpoint ran and deal updated

```sql
-- Replace with your booking_token_deals table / deal id
SELECT id, lead_type, lead_id, listing_type, booking_status,
       cancellation_approval_status, cancellation_reason, cancelled_at
FROM booking_token_deals
WHERE id = '9f87fa60-0e6f-485f-a8e7-0290b46245d5';
```

**Expect if cancel applied:**  
`cancellation_approval_status = PENDING` and/or `booking_status = pending_cancellation`

**If deal updated but lead not → milestone service not called or not flushed.**

---

### B. Confirm lead milestone in DB

```sql
-- Use lead_type + lead_id from deal row (e.g. form_leads / crm_leads)
SELECT id, milestone_stage, milestone_stage_category, milestone_sub_stage, resone,
       bt_previous_milestone_substage, bt_cancellation_approval_status,
       bt_cancellation_requested_at, bt_cancellation_deal_id
FROM <lead_table>
WHERE lead_identifier = 'AL-EDHTFUX2DN';
-- OR id from deal.lead_id
```

| Column | Expected after cancel request | Likely actual (bug) |
|--------|------------------------------|---------------------|
| `milestone_sub_stage` | **Project Cancelled After Token** | **Token Done** |
| `milestone_stage_category` | **Closed Lost** | **Closed Won** |
| `bt_cancellation_deal_id` | deal uuid | NULL or missing |
| `resone` | cancel reason | empty / old |

---

### C. Inspect cancel API response body

Re-run cancel on a test lead (or read access logs). Response **must** include (per latest Hub fix):

```json
{
  "id": "9f87fa60-0e6f-485f-a8e7-0290b46245d5",
  "bookingStatus": "pending_cancellation",
  "leadType": "formlead",
  "leadId": 12345,
  "milestoneStage": "Closed",
  "milestoneStageCategory": "Closed Lost",
  "milestoneSubStage": "Project Cancelled After Token"
}
```

| Response | Meaning |
|----------|---------|
| No `milestoneSubStage` | `BookingTokenService` not returning lead sync fields |
| `milestoneSubStage` correct in response but DB/GET lead wrong | flush/transaction issue or wrong lead row updated |
| `leadId` null | deal not linked → `applyCancelledAfter()` never runs |

---

### D. Verify `GET .../cancellation` for lead

```http
GET /v1/booking-token/leads/{leadType}/{leadId}/cancellation
```

FE uses this for Restore bar (`BookingTokenCancellationBar.tsx`).

**If 404 or empty while deal is pending cancel → cancellation snapshot not persisted on lead.**

---

### E. Code paths to audit in Hub (Project-ERP)

| Class / method | What to verify |
|----------------|----------------|
| `BookingTokenService` | On `POST cancel` with `scope=deal`, calls milestone **before** response — not only on approve |
| `applyCancellationSnapshot()` | Runs **on cancel request**, not only on approve/reject |
| `BookingTokenLeadMilestoneService.applyCancelledAfter()` | Called for `pending_cancellation` path, not only `cancelled` |
| `readMilestoneSubStage()` / `readMilestone()` | Uses `REQUIRES_NEW` (fix deployed to **hows** env?) |
| `mutateLead()` | `saveAndFlush()` — check logs for “lead not found” exception |
| Category | Uses **Closed Lost** from `LeadMilestones.java` — wrong category may fail validation silently in older code |

---

## 6. Most likely root causes (ranked)

1. **`pending_cancellation` branch skips milestone**  
   Deal status updated to pending; `applyCancelledAfter()` only runs on full `cancelled` / approve — **violates spec §4.1** (milestone must change on cancel **request**).

2. **Read-only transaction fix not deployed** on `hows.hubinterior.com`  
   Known bug: inner `@Transactional(readOnly=true)` read poisoned cancel transaction → deal saved, milestone not flushed.  
   Fix: `REQUIRES_NEW` on reads + `saveAndFlush()` — confirm **deployed build** on this environment.

3. **Deal → lead link missing**  
   `lead_type` / `lead_id` null on deal → milestone service no-ops or throws (should throw after fix).

4. **Milestone catalog mismatch**  
   `Project Cancelled After Token` under **Closed Lost** — if service still writes **Closed Won**, pipeline validation may reject update (check Hub error logs).

5. **Lead GET cache / wrong table**  
   Less common: milestone updated in DB but detail API serves stale join — verify DB vs `GET .../details/{id}`.

---

## 7. Spec reference (Hub must implement)

From `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md` §4.1:

> On successful full-deal cancel: update linked lead milestone to **Project Cancelled After Token/Booking** under **Closed Lost**.  
> **Do not leave lead on Token/Booking Done while cancel is pending.**

---

## 8. Frontend behaviour (for context)

| Event | FE action |
|-------|-----------|
| User clicks Cancellation → confirms | `POST .../cancel` with `{ reason, scope: "deal" }` |
| Success | Refreshes deals list only — **does not reload lead detail** |
| Lead detail | User must refresh page — reads Hub `GET lead details` |

Even without lead refresh, **DB + lead GET after hard refresh** should show Cancelled After if Hub persisted correctly. Still showing Token Done = **Hub did not persist**.

---

## 9. Acceptance test (after Hub fix)

1. Lead on **Token Done**, token deal active, within 24h window.  
2. `POST /v1/booking-token/deals/{id}/cancel` scope `deal`.  
3. **Within same transaction / response:**  
   - Deal: pending cancel  
   - Lead DB: `milestone_sub_stage = Project Cancelled After Token`, category **Closed Lost**  
   - Response includes `milestoneSubStage`  
4. `GET lead details` → same substage (not Token Done).  
5. `GET .../leads/{type}/{id}/cancellation` → `btCancellationApprovalStatus=PENDING`, `canRestoreBookingTokenCancellation=true` (if applicable).  
6. Lead detail UI → Restore / View bar visible.

---

## 10. Related docs

- Full cancel milestone spec: `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md`  
- Previous flush bug write-up: `docs/BOOKING_TOKEN_CANCEL_MILESTONE_NOT_UPDATING_BACKEND_HANDOFF.md`  
- FE wiring (no milestone PUT): `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_FRONTEND.md`

---

## 11. Contact / handoff

Share this file + **deal id** `9f87fa60-0e6f-485f-a8e7-0290b46245d5` + **lead** `AL-EDHTFUX2DN` with Hub backend.  
Ask them to return: cancel API response JSON, lead row after cancel, and whether `applyCancelledAfter()` ran in logs for the **pending_cancellation** path.

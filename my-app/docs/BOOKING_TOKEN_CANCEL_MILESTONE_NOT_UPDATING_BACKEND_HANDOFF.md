# Cancel Applied but Lead Milestone Still Token Done — Backend Fix

**Status:** ✅ Fixed in Hub (`BookingTokenLeadMilestoneService` + `BookingTokenService`)  
**Audience:** Hub / Spring backend (`Project-ERP`) + CRM FE  
**Example lead:** `test-lead -for-design` · `AL-EDHTFUX2DN` · Quote 71438

---

## One-line issue (was)

**Hub set the B&T deal to `cancelled` on `POST .../cancel`, but Hibernate `@Transactional(readOnly = true)` on an inner milestone read marked the cancel transaction read-only, so `applyCancelledAfter()` did not persist — lead stayed on Token Done.**

---

## Root cause (Hub)

`applyCancellationSnapshot()` called `readMilestoneSubStage()` with `@Transactional(readOnly = true)` **inside** the same transaction as the milestone write. That made the session read-only; deal updated, lead substage did not flush.

---

## Hub fix (shipped)

1. **`BookingTokenLeadMilestoneService`**
   - `readMilestoneSubStage()` / `readMilestone()` use `REQUIRES_NEW` so reads don’t poison the cancel transaction
   - `mutateLead()` uses `saveAndFlush()` and throws if lead missing
   - `applyCancelledAfter()` returns applied substage

2. **`BookingTokenService`**
   - Persists cancellation snapshot before finalize on direct cancel
   - Cancel response includes lead sync: `leadType`, `leadId`, `milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`

3. **Test:** `BookingTokenLeadMilestoneServiceTest` — Token Done → Project Cancelled After Token

---

## Expected after cancel (QA)

| Check | Expected |
|-------|----------|
| Lead substage | **Project Cancelled After Token** (or Booking variant) |
| Lead category | **Closed Lost** (pipeline catalog — not Closed Won) |
| Lead detail | Restore / View bar visible |
| B&T deal | `listingType=cancel`, booking **CANCELLED** |
| Cancel API response | Includes `milestoneSubStage` for FE refresh |

---

## Frontend notes

| Rule | Detail |
|------|--------|
| Detect cancel state | Key off **`milestoneSubStage`** containing `Project Cancelled After` — **not** category alone |
| Cancelled-after category | Hub uses **Closed Lost** per `LeadMilestones.java` |
| Cancel response type | `BookingTokenCancelResponse` includes milestone sync fields (`lib/booking-done-api.ts`) |
| Restore bar | `resolveCancellationActionVisibility()` + `isClosureCancelledAfterSubstage()` in `lib/milestone-substage-map.ts` |
| Complete Task | Cancelled-after substages hidden via `lib/auto-managed-milestone-substages.ts` |

FE does **not** `PUT` milestone on cancel — Hub owns it. Reload lead detail after cancel to pick up substage + cancellation bar.

---

## Cancel response (Hub)

```json
{
  "id": "…",
  "listingType": "cancel",
  "bookingStatus": "cancelled",
  "leadType": "crm-leads",
  "leadId": 12345,
  "milestoneStage": "Closed",
  "milestoneStageCategory": "Closed Lost",
  "milestoneSubStage": "Project Cancelled After Token"
}
```

---

## Related docs

- Full cancellation spec: `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md`
- FE wiring: `docs/BOOKING_TOKEN_CANCELLATION_MILESTONE_FRONTEND.md`

# Booking & Token — Cancellation Milestones (Frontend)

**Status:** Hub backend implemented · FE wired to Hub APIs (no `localStorage` interim)  
**Audience:** Booking & Token dashboard, lead detail, manager approval UI  
**Related:** [BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md](./BOOKING_TOKEN_CANCELLATION_MILESTONE_BACKEND_HANDOFF.md)

---

## 1. Simple rule (tell users)

| Rule | Detail |
|------|--------|
| **24-hour window** | Sales can request cancellation only within **24 hours** of deal creation (`createdAt`) |
| **Manager approval** | Sales request → manager **Approve** or **Reject** |
| **Two attempts max** | After 1st reject, sales can **Send again** once (attempt 2) |
| **2nd reject** | Hub **auto-restores** lead to previous **Token Done** / **Booking Done** |
| **Restore** | Sales can **Restore** anytime before manager approves refund |
| **Milestones** | Hub sets CRM substage — **do not** PUT milestone from FE on cancel/restore |

---

## 2. Frontend implementation (done)

| Removed | Replaced with |
|---------|----------------|
| `localStorage` `crm-bt-cancellation:*` | `GET /api/crm/booking-token/leads/{type}/{id}/cancellation` |
| `localStorage` `crm-bt-activity:*` | Hub activities (`BOOKING_TOKEN_*`) |
| FE `PUT` milestone on cancel / approve / reject / restore | Hub deal + lead cancellation APIs |

**Key files:** `lib/cancellation-milestone.ts`, `BookingTokenCancellationBar.tsx`, `DealsTable.tsx`, BFF routes under `app/api/crm/booking-token/leads/.../cancellation/`

---

## 3. Hub base URLs

| Path prefix | Use |
|-------------|-----|
| `/v1/booking-token/...` | Direct Hub |
| `/api/crm/booking-token/...` | BFF alias |

---

## 4. API reference

See backend handoff §4 for full contract. FE calls:

- `POST .../deals/{id}/cancel`
- `POST .../cancel/approve` / `.../reject` / `.../resubmit`
- `GET .../leads/{type}/{id}/cancellation`
- `POST .../leads/{type}/{id}/cancellation/restore`

---

## 5. UI flags (prefer Hub booleans)

- `canRestoreBookingTokenCancellation` → **Restore**
- `canResubmitBookingTokenCancellation` → **Send again**
- `canApproveCancellation` → manager Approve/Reject

Pay / Convert hidden when `cancellationApprovalStatus === PENDING` (mapped in `booking-token-leads.ts`).

---

## 6. Activity History

Hub `BOOKING_TOKEN_*` activity types map to filter pill **Booking & Token** via `mapBackendActivityType()` in `lead-detail-mapper.ts`.

---

## 7. Checklist

- [x] Remove `crm-bt-cancellation:*` and `crm-bt-activity:*` from `localStorage`
- [x] Wire cancel → Hub `POST .../cancel` (no FE milestone PUT)
- [x] Wire approve/reject → Hub only
- [x] Wire **Send again** → `POST .../cancel/resubmit` + `canResubmitBookingTokenCancellation`
- [x] Wire **Restore** → `POST .../cancellation/restore` + `canRestoreBookingTokenCancellation`
- [x] Lead banner from `GET .../cancellation`
- [x] Disable Pay / Convert when pending
- [x] Activity tab uses Hub `BOOKING_TOKEN_*` events
- [x] Refresh deal + lead after reject (Hub auto-restore on 2nd reject)

# WhatsApp Presales Milestone — Frontend Integration Guide

**Audience:** Next.js BFF + CRM UI  
**Backend fix:** 2026-06-23 — `WhatsappLeadDetailsService` + `WhatsappLead.setStageJson`  
**Related:** [WHATSAPP_PRESALES_MILESTONE_BACKEND_HANDOFF.md](./WHATSAPP_PRESALES_MILESTONE_BACKEND_HANDOFF.md)

---

## 1. Summary

| Before fix | After fix |
|------------|-----------|
| PUT returned 200 but presales milestone often **not in DB** | PUT **persists** `presalesMilestoneStage/Category/SubStage` |
| CRM relied on **browser/local storage** fallback | Use **Hub response + refetch** — same as Add Lead / Form Lead |
| Other device saw **Fresh Data** again | All users/devices see **same saved milestone** |

**No new API endpoints.** Same URLs and JSON shape as Add Lead / Form Lead presales Complete Task.

---

## 2. Do frontend changes exist?

| Area | Change needed? | CRM status |
|------|----------------|------------|
| **API URL / BFF route** | **No** | Done — `PUT /api/crm/lead/whatsapplead/{id}` |
| **Request body** | **No** | Done — `buildMinimalPresalesMilestonePutBody` |
| **After save: trust server** | **Yes** | Done — no WhatsApp localStorage overlay |
| **After save: refetch** | **Yes** | Done — `dispatchCrmLeadsInvalidate` + GET verify |
| **Error handling** | **Yes** | Done — Hub 400/403 via `putPresalesMilestoneDetail` |
| **List / filter** | **No** | Same filter API |

---

## 3. Endpoints

| Action | Hub URL | BFF (example) |
|--------|---------|---------------|
| Save presales milestone | `PUT /v1/WhatsappLead/details/{id}` | `PUT /api/crm/lead/whatsapplead/{id}` |
| Read single lead | `GET /v1/WhatsappLead/details/{id}` | Same pattern |
| List | `GET /v1/leads/filter?leadType=whatsapplead` | Same pattern |

Fallback (same handler): `PUT /v1/WhatsappLead/{id}`

---

## 4. PUT body — presales Complete Task

Send **root fields + nested `stage`** (mirror Add Lead / Form Lead):

```json
{
  "presalesMilestoneStage": "Data Discovery",
  "presalesMilestoneCategory": "Active",
  "presalesMilestoneSubStage": "Call Back",
  "followUpDate": "2026-06-25T10:00:00",
  "stage": {
    "presalesMilestoneStage": "Data Discovery",
    "presalesMilestoneCategory": "Active",
    "presalesMilestoneSubStage": "Call Back"
  }
}
```

**Minimal milestone-only update** (no full lead body required) — **used by CRM for WhatsApp**:

```json
{
  "presalesMilestoneStage": "Data Discovery",
  "presalesMilestoneCategory": "Active",
  "presalesMilestoneSubStage": "Call Back"
}
```

### Do NOT send

```json
{ "stage": {} }
```

Empty `stage` object is unnecessary; root presales fields are enough.

---

## 5. Response fields (GET + PUT)

Hub returns presales milestone on **root** and inside **`stage`**:

```json
{
  "id": 42,
  "leadType": "whatsapplead",
  "presalesMilestoneStage": "Data Discovery",
  "presalesMilestoneCategory": "Active",
  "presalesMilestoneSubStage": "Call Back",
  "followUpDate": "2026-06-25T10:00:00",
  "verified": false,
  "verificationStatus": "UNVERIFIED",
  "stage": {
    "milestoneStage": "Fresh Lead",
    "milestoneStageCategory": "",
    "milestoneSubStage": "",
    "presalesMilestoneStage": "Data Discovery",
    "presalesMilestoneCategory": "Active",
    "presalesMilestoneSubStage": "Call Back"
  }
}
```

**UI source of truth after save:** use **`presalesMilestoneStage`** (root) or `stage.presalesMilestoneStage` — they match after fix.

Default for new WhatsApp lead: presales stage **`Fresh Data`** (empty category/substage until user completes task).

---

## 6. CRM code map

| File | Role |
|------|------|
| `LeadDetailsApiClient.tsx` | `handlePresalesCompleteTaskApi` |
| `lib/lead-detail-mapper.ts` | `buildMinimalPresalesMilestonePutBody`, `readPresalesMilestoneFromDetail` |
| `lib/lead-details-client.ts` | `putPresalesMilestoneDetail` |
| `lib/lead-presales-milestone-store.ts` | Walk-in overlay only |
| `lib/crm-leads-invalidate.ts` | List refetch after save |
| `app/api/crm/lead/[leadType]/[id]/route.ts` | WhatsApp PUT URL fallback |

### Save flow

```
CompleteTaskModal (presalesMode)
  → handlePresalesCompleteTaskApi
  → buildMinimalPresalesMilestonePutBody (whatsapplead)
  → putPresalesMilestoneDetail → PUT /api/crm/lead/whatsapplead/{id}
  → Trust PUT response OR GET verify
  → dispatchCrmLeadsInvalidate
  → UI from Hub JSON only
```

---

## 7. Errors (400)

Hub validates presales transitions (same rules as Form Lead). Example:

```json
{
  "message": "Invalid presales milestone transition: Fresh Data -> Data Conversion. Allowed from Fresh Data: Fresh Data, Data Discovery, ...",
  "success": false
}
```

Show `message` in toast/modal — do not treat as success.

| Status | Meaning |
|--------|---------|
| `401` | Missing/invalid token |
| `403` | User can only update leads assigned to them |
| `404` | Lead not found |
| `400` | Invalid milestone transition or closed-booking validation |

Verified WhatsApp lead: presales milestone is **locked** — Hub returns 400 if presales tries to change it (use verify flow for sales handoff).

---

## 8. Flow diagram

```text
Presales user — Complete Task on WhatsApp lead
        │
        ▼
PUT /v1/WhatsappLead/details/{id}
  presalesMilestoneStage / Category / SubStage
        │
        ▼
Hub saves to DB (whatsapplead.presales_milestone_*)
        │
        ├─► PUT response = saved lead JSON
        │
        └─► GET list / GET details / other user → same milestone
```

---

## 9. QA checklist (frontend)

- [ ] Open WhatsApp lead (unverified) — presales shows **Fresh Data**
- [ ] Complete Task → **Data Discovery / Active / Call Back**
- [ ] PUT returns 200 with same presales fields in body
- [ ] Refresh page — milestone still **Data Discovery** (not Fresh Data)
- [ ] Open **same lead in another browser/user** — same milestone
- [ ] List tab `whatsapplead` shows updated presales columns
- [ ] Invalid transition shows Hub error message (400), UI does not fake success
- [ ] No dependency on localStorage for milestone after save

---

## 10. Parity with other lead types

| Lead type | PUT details path | Presales fields |
|-----------|------------------|-----------------|
| Add Lead | `/v1/AddLead/details/{id}` | Same JSON |
| Form Lead | `/v1/FormLead/details/{id}` | Same JSON |
| **WhatsApp** | `/v1/WhatsappLead/details/{id}` | **Same JSON (now persists)** |

Reuse the same presales Complete Task component; only change `leadType` / API base path.

---

## 11. Changelog

| Date | Backend | Frontend action |
|------|---------|-----------------|
| 2026-06-23 | Fix presales milestone persistence on WhatsApp PUT | Stop local-only fallback; refetch from Hub after save |

---

## 12. Troubleshooting — followUpDate saves but presales stays "Fresh Data"

Symptom (example: lead id **85**):

| Field | GET after PUT |
|-------|----------------|
| `followUpDate` | Updated |
| `updatedAt` | Changed |
| `presalesMilestoneStage` | Still **Fresh Data** |

**Meaning:** PUT partially worked. `followUpDate` is a **direct column** on `whatsapplead`. Presales lives on **embedded `stage`** — needs explicit `setStage()` flush (fixed in Hub 2026-06-23).

| PUT result | Cause |
|------------|--------|
| **200** + Fresh Data (old Hub) | Embedded stage not flushed — **deploy latest backend** |
| **200** + Fresh Data (Admin/Super Admin)** | Hub must apply presales merge for `ADMIN` / `SUPER_ADMIN` on WhatsappLead PUT (parity with Add Lead) — **backend fix**, not CRM block |
| **200** + Fresh Data (presales user)** | Deploy/migration or invalid transition |
| **403** | Assignee scope |
| **400** | Invalid presales transition — show Hub `message` |

CRM allows Admin/Super Admin to open presales Complete Task (`canViewBothMilestonePipelines`). Save is **not blocked** by role — if PUT 200 but GET still Fresh Data, Hub did not persist the milestone.

**Post-deploy test for lead 85:**

```http
PUT /v1/WhatsappLead/details/85
{ "presalesMilestoneStage": "Data Discovery", "presalesMilestoneCategory": "Active", "presalesMilestoneSubStage": "Call Back" }
```

GET immediately after → must **not** be Fresh Data.  
**Must test as presales role** (assignee Alice = presales exec), not only SUPER_ADMIN.

---

## 13. Backend reference

`WhatsappLeadDetailsService.updateWhatsappLead`, `WhatsappLead.setStageJson`, `CrmMilestoneMergeHelper.validateAndMergePresalesMilestone`.

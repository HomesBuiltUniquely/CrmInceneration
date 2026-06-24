# WhatsApp Presales Milestone — Backend Handoff & Fix

**Status:** Fixed in Hub backend (2026-06-23)  
**Related:** [WHATSAPP_PRESALES_MILESTONE_FRONTEND.md](./WHATSAPP_PRESALES_MILESTONE_FRONTEND.md)

---

## Problem (before fix)

| What worked | What failed |
|-------------|-------------|
| `PUT /v1/WhatsappLead/details/{id}` returned **200 OK** | `presales_milestone_*` columns **not persisted** in DB |
| CRM showed saved milestone (local/browser fallback) | Another user/device → milestone back to **Fresh Data** |

Root causes:

1. **`whatsapplead` table** was missing `presales_milestone_stage/category/sub_stage` columns (migration only covered formlead/glead/mlead/addlead/websitelead).
2. **`WhatsappLead.setStageJson`** replaced the entire embedded `Stage`, wiping root-level presales fields when CRM sent both.
3. **`WhatsappLeadDetailsService`** called `existing.setStage(updated.getStage())` after `validateAndMergePresalesMilestone` had already merged presales **in-place** on the existing embedded object — the replace could drop merged values.

---

## Fix applied

| Area | Change |
|------|--------|
| DB | `presales_milestone_*` columns added for `whatsapplead` — see `whatsapplead_presales_milestone_migration.sql` |
| `WhatsappLead.java` | `setStageJson` **merges** incoming stage fields instead of blind replace |
| `WhatsappLeadDetailsService.java` | Presales merge in-place; `saveAndFlush`; handle milestone-only PUT; init default presales stage on legacy rows |

---

## Endpoints (unchanged URLs)

| Method | URL | Behavior after fix |
|--------|-----|-------------------|
| **PUT** | `/v1/WhatsappLead/details/{id}` | Persists presales milestone (+ optional `followUpDate`) |
| **PUT** | `/v1/WhatsappLead/{id}` | Same handler |
| **GET** | `/v1/WhatsappLead/details/{id}` | Returns saved `presalesMilestoneStage/Category/SubStage` (root + `stage`) |
| **GET** | `/v1/leads/filter?leadType=whatsapplead` | List includes same fields |

---

## PUT body (CRM already sends this — no frontend change)

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

---

## DB columns

| JSON field | Column on `whatsapplead` |
|------------|--------------------------|
| `presalesMilestoneStage` | `presales_milestone_stage` |
| `presalesMilestoneCategory` | `presales_milestone_category` |
| `presalesMilestoneSubStage` | `presales_milestone_sub_stage` |

**Deploy step:** run on production DB:

```sql
ALTER TABLE whatsapplead
  ADD COLUMN IF NOT EXISTS presales_milestone_stage VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS presales_milestone_category VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS presales_milestone_sub_stage VARCHAR(100) NULL;
```

(MySQL 8+ supports `IF NOT EXISTS` on `ADD COLUMN`; on older MySQL, run once manually or ignore duplicate-column errors.)

---

## Postman QA

**1. GET before**

```http
GET {HUB_BASE}/v1/WhatsappLead/details/{id}
Authorization: Bearer {token}
```

**2. PUT milestone only**

```http
PUT {HUB_BASE}/v1/WhatsappLead/details/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "presalesMilestoneStage": "Data Discovery",
  "presalesMilestoneCategory": "Active",
  "presalesMilestoneSubStage": "Call Back",
  "stage": {
    "presalesMilestoneStage": "Data Discovery",
    "presalesMilestoneCategory": "Active",
    "presalesMilestoneSubStage": "Call Back"
  }
}
```

**3. GET after** — same URL; expect saved presales values (not Fresh Data).

**4. GET list**

```http
GET {HUB_BASE}/v1/leads/filter?leadType=whatsapplead&page=0&size=20
Authorization: Bearer {token}
```

**5. DB**

```sql
SELECT id, presales_milestone_stage, presales_milestone_category, presales_milestone_sub_stage
FROM whatsapplead WHERE id = {id};
```

**6. Cross-device** — open same lead from another browser/user; milestone must match.

---

## Rules (same as AddLead / FormLead)

1. Presales milestone transitions validated via `CrmMilestoneMergeHelper` / `LeadMilestones`
2. Verified leads: presales milestone **locked** after verification
3. Sales milestone fields on PUT are **not** reset when only presales fields are sent
4. Assignee must be presales role to change presales milestone (otherwise existing values preserved)

---

## One-line summary

> WhatsApp presales milestones now persist on `PUT /v1/WhatsappLead/details/{id}` and return on GET + filter.

**Frontend guide:** [WHATSAPP_PRESALES_MILESTONE_FRONTEND.md](./WHATSAPP_PRESALES_MILESTONE_FRONTEND.md)

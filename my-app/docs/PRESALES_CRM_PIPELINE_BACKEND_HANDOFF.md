# Presales `crm-pipeline` for Complete Task

**Status:** Backend implemented (Hub). Frontend integrated via `GET /api/crm/crm-pipeline`.

---

## API call (presales Complete Task)

```http
GET /api/crm/crm-pipeline?nested=true&forCompleteTask=true&currentStage=Fresh%20Data&role=PRESALES_EXECUTIVE
Authorization: Bearer <token>
```

Proxied to:

```http
GET /v1/Leads/crm-pipeline?nested=true&forCompleteTask=true&currentStage=Fresh%20Data&role=PRESALES_EXECUTIVE
```

### Query parameters

| Param | Required | Example |
|--------|----------|---------|
| `nested` | yes | `true` |
| `forCompleteTask` | yes | `true` |
| `currentStage` | yes | `Fresh Data` / `Data Discovery` / `Data Conversion` |
| `role` | yes | `PRESALES_EXECUTIVE` |

### Expected response

```json
{
  "entries": [
    { "stage": "Fresh Data", "stageCategory": "…", "subStageName": "…" }
  ],
  "nested": [ { "stage": "Fresh Data", "categories": [ … ] } ]
}
```

Backend returns **current + next** substages only (same rules as sales `forCompleteTask`).

---

## Frontend behavior

| File | Role |
|------|------|
| `app/api/crm/crm-pipeline/route.ts` | Auth proxy to Hub |
| `lib/crm-pipeline.ts` | `fetchCrmPipeline()` from browser |
| `lib/complete-task-pipeline.ts` | Maps `entries` → Complete Task feedback list |
| `app/Components/CrmLeadDetails/CompleteTaskModal.tsx` | Loads pipeline, auto-fills Status + Path from Feedback |

**Primary path:** `nested=true&role=PRESALES_EXECUTIVE` → full presales catalog (`Fresh Data`, `Data Discovery`, `Data Conversion` and all substages). Sales-only stages (e.g. `Discovery`) are excluded.

**Fallback:** `forCompleteTask=true` when the full catalog is empty. Legacy `milestone-count` fallback is filtered to presales stages only.

Complete Task save (unchanged): PUT lead detail with `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage`, `followUpDate`, `resone` on LOST.

---

## Quick verification

1. Open a presales lead → **Complete Task**.
2. Network: `crm-pipeline?…forCompleteTask=true…role=PRESALES_EXECUTIVE` → `entries` not empty.
3. **Feedback** dropdown lists **all presales substages** (Fresh Data, Data Discovery, Data Conversion); **Status** / **Path** update when feedback is selected. Verify-handoff (`Data Conversion / Assigned`) stays hidden on unverified leads in the UI.

---

## Historical note

Earlier Hub returned `{ "entries": [], "nested": [] }` for presales; that was a backend gap, not a frontend proxy bug. Resolved on Hub per this contract.

# New CRM — Sales & Presales Backend Changes (Frontend Handoff)

Backend updates are in Hub API. **URLs mostly unchanged** — behavior and error JSON changed. This doc tracks what the Next.js proxy + UI must do.

**Deploy:** Restart Hub after pulling backend. No new backend env vars.

## One-line summary

> Use `milestoneScope=crm` on all New CRM list calls; merge all 5 lead types; show API `userMessage` on save errors; presales must use **Verify Lead** for `Data Conversion / Won / Assigned`, not Complete Task on unverified leads; send presales milestones in `stage` (and root fields in sync); sales milestone tabs match `milestoneStage` on the backend.

## Frontend checklist (implemented in this repo)

### List / inbox

- [x] `milestoneScope=crm` on merged list calls (`LeadsDataSection`, heatmap, dashboard, proxy filter)
- [x] All 5 `leadType`s for presales manager via `getAllowedLeadTypesForRole`
- [x] Pagination uses `totalElements` / `totalPages` (proxy merges upstream pages per type using Hub `totalPages`)
- [x] No second assignee filter for presales when upstream is CRM-scoped (`trustPresalesUpstreamLeadScope`)
- [x] Tab/filter change resets `page=0`
- [x] 403 per lead type → `accessDeniedLeadTypes` + toast (not silent `0`)

### Sales UI

- [x] Milestone tabs send `stage` / `substage` query params
- [x] Backend matches `milestoneStage` with `milestoneScope=crm`

### Presales UI

- [x] Complete Task pipeline: `forCompleteTask=true&currentStage=...`
- [x] Unverified: **Data Conversion / Won / Assigned** hidden in Complete Task; client guard + Hub `userMessage`
- [x] Verify flow for handoff to sales (existing)
- [x] PUT syncs `stage.presalesMilestone*` with root fields (`normalizeLeadUpdatePayload`)
- [x] Save errors use `userMessage` → `error` → `message` (`lead-details-client`)

### Proxy

- [x] `PUT /api/crm/lead/*` forwards upstream error body when present
- [x] `GET` filter forwards `milestoneScope`, `leadType`, auth header

## Key proxy routes

| UI | Proxy |
|----|-------|
| List | `GET /api/crm/leads?mergeAll=1&milestoneScope=crm&...` |
| Pipeline | `GET /api/crm/crm-pipeline?nested=true&forCompleteTask=true&currentStage=...` |
| Detail save | `PUT /api/crm/lead/{leadType}/{id}` |

## Error parsing (required)

```typescript
const msg =
  data?.userMessage ??
  data?.error ??
  data?.message ??
  "Unable to save lead details. Please try again.";
```

## Related docs

- `docs/NEW_CRM_CUTOFF_FRONTEND_HANDOFF.md`
- `docs/NEW_CRM_ERROR_HANDLING_UPDATE.md`
- `docs/PRESALES_ROLES_MASTER_GUIDE_NEW_FRONTEND.md`
- `docs/PRESALES_CRM_PIPELINE_BACKEND_HANDOFF.md`

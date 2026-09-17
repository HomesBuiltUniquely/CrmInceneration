# CRM Insights — Hold Funnel (Hub + FE)

**Status:** ✅ Shipped on Hub `GET /v1/crm/insights/dashboard` · Frontend prefers `holdFunnel` + `holdPathByStage`  
**Source of truth:** Sales pipeline catalog in `LeadMilestones` (Hold **category** under a milestone + mapped substages)  
**Consumers:** Insights Hold tab + stage modal (`holdFunnel`, `holdPathByStage`)  
**FE files:** `lib/crm-insights-api.ts`, `InsightsSect3.tsx`, `InsightsClient.tsx`, `lib/insights-funnel-stage-paths.ts` (`mergeHubHoldPathByStage`)

---

## Business rules

| Concept | Hub meaning |
|--------|-------------|
| **Won / Lost** | Pipeline **categories** (`milestoneStageCategory`) |
| **Hold** | Hold-named **categories** under a milestone (e.g. Discovery Hold), with catalog **substages** |

1. Hold tab shows **only milestones that have ≥1 Hold category** in the active sales catalog.
2. Counts = leads **currently** on those Hold mappings (same Insights date / branch / SM / SE scope as `lostFunnel`).
3. A lead counted as **Lost** is **never** counted as Hold.
4. Substage drill-down lists **exact catalog Hold substages** (0-count rows included).

### Current sales catalog Hold inventory

| stageKey | stageLabel | Category | Substage (`title`) | `subStageKey` |
|----------|------------|----------|--------------------|---------------|
| `discovery` | Discovery | Discovery Hold | On Hold due to Possession | `on_hold_due_to_possession` |
| `connection` | Connection | Connection Hold | On Hold | `on_hold` |
| `exp_design` | Exp & Design | Experience & Design Hold | On Hold | `on_hold` |
| `decision` | Decision | Decision Hold | Project on Hold | `project_on_hold` |

Fresh Lead / Closed have **no** Hold mapping → omitted from `holdFunnel.stages`.

---

## Response blocks

Same filters/auth as the rest of the dashboard.

```json
{
  "holdFunnel": {
    "total": 84,
    "stages": [
      { "stageKey": "discovery", "stageLabel": "Discovery", "count": 40, "sharePercent": 48 },
      { "stageKey": "connection", "stageLabel": "Connection", "count": 22, "sharePercent": 26 },
      { "stageKey": "exp_design", "stageLabel": "Exp & Design", "count": 15, "sharePercent": 18 },
      { "stageKey": "decision", "stageLabel": "Decision", "count": 7, "sharePercent": 8 }
    ]
  },
  "holdPathByStage": {
    "discovery": {
      "holdTotal": 40,
      "substages": [
        { "subStageKey": "on_hold_due_to_possession", "title": "On Hold due to Possession", "count": 40 }
      ]
    },
    "connection": {
      "holdTotal": 22,
      "substages": [
        { "subStageKey": "on_hold", "title": "On Hold", "count": 22 }
      ]
    }
  }
}
```

| Field | Rule |
|-------|------|
| `holdFunnel.stages` | Catalog-gated; sales-funnel order among included stages |
| `holdFunnel.total` | Sum of stage counts (unique leads; one Hold stage each) |
| `sharePercent` | `(stage.count / total) × 100`, integer; `0` when total is `0` |
| `holdPathByStage[*].substages` | Exact catalog Hold substages; include zeros |
| Currency | Count only (no INR), same as Lost |

---

## Frontend switchover (done)

| Payload | UI use |
|---------|--------|
| `holdFunnel` | Hold tab bars, Total count, `sharePercent` |
| `holdPathByStage` | Merged into path data → modal On Hold list + All-tab hold badge |
| Client mapping heuristics | Used **only** if Hub omits Hold blocks |

Normalization: `normalizeHoldFunnel` / `normalizeHoldPathByStage` in `crm-insights-api.ts`.

---

## Classification (Hub)

1. Load Hold rows from `LeadMilestones` pipeline where `stageCategory` matches Hold semantics (`\bhold\b`).
2. Lead is On Hold when **not Lost** and either:
   - current `milestoneSubStage` equals a catalog Hold substage under the lead’s milestone, **or**
   - current `milestoneStageCategory` is a Hold category for that milestone.
3. Stage bucket = current sales milestone (`discovery` / `connection` / `exp_design` / `decision` / …).

Implementation: `CrmInsightsHoldCatalog`, `CrmInsightsHoldSegmentClassifier`, wired in `CrmInsightsDashboardService`.

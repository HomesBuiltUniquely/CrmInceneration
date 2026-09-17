# CRM Insights — Lost Funnel Backend Handoff

**Status:** ✅ Shipped — Hub returns `lostFunnel` · Frontend consumes it  
**Audience:** Hub / CRM backend team  
**Frontend consumer:** `InsightsSect3.tsx` → `lostFunnel` from `GET /v1/crm/insights/dashboard`  
**Backend reference:** `CrmInsightsLostSegmentClassifier.java`, `CrmInsightsDashboardService.buildLostFunnel()`, `CRM_INSIGHTS_DASHBOARD_API.md`  
**Related:** Lost Segment tiles on Leads page (`lib/lead-lost-segment.ts`)

---

## 1. Recommendation: extend dashboard API (no separate endpoint)

**Do not create a new API.** Add a `lostFunnel` block to the existing insights dashboard response.

| Approach | Verdict |
|----------|---------|
| **Extend `GET /v1/crm/insights/dashboard`** | ✅ **Use this** — same filters, auth, role scope, date window |
| Separate `/lost-segment` or `/lost-funnel` API | ❌ Duplicate queries, filter drift, extra round-trip |

Lost Funnel is the **same dataset** as Lost Segment tiles on the Leads page, aggregated for the Insights dashboard filters (`dateRange`, `branchId`, `salesManagerId`, `salesExecutiveId`).

---

## 2. UI requirements (what frontend shows)

When user toggles **Lost Funnel** on Sales Funnel Efficiency:

- Show **6 stages** (top → bottom): Fresh Lead Lost → Discovery Lost → Connection Lost → Exp & Design Lost → Decision Lost → Closed Lost
- Show **lead count only** — **no INR / rupee values**
- Show **Drop %** = `(stageCount / totalLost) × 100`, rounded to nearest integer
- Header badge: **Lost Funnel (totalLost)** — sum of all stage counts

Active / Won funnel continues to use existing `salesFunnel` (unchanged).

---

## 3. API contract

### Endpoint

Same as dashboard — no new route:

```http
GET /v1/crm/insights/dashboard?dateRange=6m&branchId=1&salesManagerId=10
Authorization: Bearer <token>
```

Also accepted upstream: `GET /api/crm/insights/dashboard`

### New response block

Add inside the existing dashboard JSON:

```json
{
  "kpis": { "...": "..." },
  "salesFunnel": [ "... unchanged ..." ],
  "lostFunnel": {
    "total": 1161,
    "stages": [
      {
        "stageKey": "fresh_lead_lost",
        "stageLabel": "Fresh Lead Lost",
        "count": 325,
        "dropPercent": 28
      },
      {
        "stageKey": "discovery_lost",
        "stageLabel": "Discovery Lost",
        "count": 290,
        "dropPercent": 25
      },
      {
        "stageKey": "connection_lost",
        "stageLabel": "Connection Lost",
        "count": 209,
        "dropPercent": 18
      },
      {
        "stageKey": "exp_design_lost",
        "stageLabel": "Exp & Design Lost",
        "count": 174,
        "dropPercent": 15
      },
      {
        "stageKey": "decision_lost",
        "stageLabel": "Decision Lost",
        "count": 116,
        "dropPercent": 10
      },
      {
        "stageKey": "closed_lost",
        "stageLabel": "Closed Lost",
        "count": 47,
        "dropPercent": 4
      }
    ]
  },
  "dropReasons": { "...": "..." }
}
```

### Field definitions

| Field | Type | Required | Definition |
|-------|------|----------|------------|
| `lostFunnel.total` | `number` | yes | Sum of all `stages[].count`. Must equal sum of stage counts. |
| `lostFunnel.stages` | `array` | yes | **Exactly 6 items**, fixed order (see §4). |
| `stages[].stageKey` | `string` | yes | Stable key — use values in §4. |
| `stages[].stageLabel` | `string` | yes | Display label (frontend falls back to key if missing). |
| `stages[].count` | `number` | yes | Integer ≥ 0 — lost leads in this bucket. |
| `stages[].dropPercent` | `number` | yes | `(count / total) × 100`, 0–100. Last stage may not be exactly 4% due to rounding — that is OK. |

**Do not send** `value`, `amount`, or currency fields for lost funnel — UI shows counts only.

---

## 4. Stage order and keys (fixed)

| Order | `stageKey` | `stageLabel` | Maps to Lost Segment tile |
|-------|------------|--------------|---------------------------|
| 1 | `fresh_lead_lost` | Fresh Lead Lost | *(new — see §5.1)* |
| 2 | `discovery_lost` | Discovery Lost | `lostDiscovery` |
| 3 | `connection_lost` | Connection Lost | `lostConnection` |
| 4 | `exp_design_lost` | Exp & Design Lost | `lostExperienceDesign` |
| 5 | `decision_lost` | Decision Lost | `lostDecision` |
| 6 | `closed_lost` | Closed Lost | `lostClosed` |

Always return all 6 stages even when `count = 0`.

---

## 5. Classification rules (must match Leads Lost Segment)

Hub backend must implement the **same bucketing** as frontend `lib/lead-lost-segment.ts` so Insights Lost Funnel totals match Lost Segment tiles on the Leads page for the same filter scope.

Reference implementation (TypeScript): `my-app/lib/lead-lost-segment.ts` → `classifyLostSegment()`.

### 5.1 When is a lead “lost”?

A lead is in lost funnel scope when **either**:

1. `stage.milestoneStageCategory` matches lost category (`/\blost\b/i`), **or**
2. Combined normalized text of category + `stage.milestoneStage` contains `"lost"`, **or**
3. `stage.presalesMilestoneCategory` matches lost category (presales path)

Use the same `isLostCategory()` rule: category string contains word `lost` (case-insensitive).

### 5.2 Bucket assignment (priority order)

Normalize: `trim → lowercase → collapse spaces`.

Read from lead:

- `milestoneStageCategory` (sales)
- `milestoneStage` (sales)
- `presalesMilestoneCategory` (if sales fields empty)

**Only classify leads that pass §5.1.** Then assign **first matching** rule:

| Bucket | `stageKey` | Rule |
|--------|------------|------|
| **Fresh Lead Lost** | `fresh_lead_lost` | Lost lead where `milestoneStage` is `fresh lead` / `fresh leads` / empty fresh intake **and** not yet classified into Discovery+ lost buckets below. Also: presales lost before sales milestone advancement (presales category lost, sales stage still fresh/empty). |
| **Closed Lost** | `closed_lost` | Category contains both `closed` + `lost`, **or** stage is `closed` / starts with `closed` with lost category |
| **Decision Lost** | `decision_lost` | Category contains `decision` + `lost`, **or** stage = `decision` with lost category |
| **Exp & Design Lost** | `exp_design_lost` | Category contains `experience` + `design` + lost, **or** stage is `experience & design` / `experience and design` with lost category |
| **Connection Lost** | `connection_lost` | Category contains `connection` + `lost`, **or** stage = `connection` with lost category |
| **Discovery Lost** | `discovery_lost` | Category contains `discovery` + `lost`, **or** stage = `discovery` with lost category |

If lost but no rule matches → count under **`discovery_lost`** (safe default) or expose in logs for data cleanup.

> **Important:** Evaluate **Closed → Decision → Exp&Design → Connection → Discovery** before Fresh Lead, so a lead at `Closed` + lost category never lands in Fresh Lead Lost.

### 5.3 Scope filters (same as dashboard)

Apply the **same** filters used for `salesFunnel` and `kpis`:

| Filter | Behaviour |
|--------|-----------|
| `dateRange` / `dateFrom` / `dateTo` | Count leads **marked lost** (or lost milestone entered) within the selected window — confirm with product: use **lost date** not lead created date |
| `branchId` | Branch of lead / assignee |
| `salesManagerId` | Team under manager |
| `salesExecutiveId` | That executive’s assigned leads |
| Role (JWT) | `SALES_EXECUTIVE` → own leads only; `SALES_MANAGER` → team per `leadView`; admin → org scope |

Assignee scoping must mirror `leadMatchesInsightAssigneeScope()` in `lead-lost-segment.ts`.

### 5.4 Relationship to `dropReasons`

| Block | Purpose |
|-------|---------|
| `lostFunnel` | **Where** in pipeline the lead was lost (stage bucket) |
| `dropReasons` | **Why** the lead was lost (Budget Mismatch, Competitor, etc.) |

Totals may differ if some lost leads have no drop reason recorded. Do **not** derive `lostFunnel` from `dropReasons.total`.

---

## 6. Example SQL sketch (Hub team adapts to schema)

```sql
-- Pseudocode: one row per lead with computed bucket
WITH scoped_leads AS (
  SELECT l.*
  FROM crm_leads l
  WHERE /* dateRange + branch + assignee + role scope */
    AND (
      milestone_stage_category ILIKE '%lost%'
      OR presales_milestone_category ILIKE '%lost%'
      OR (milestone_stage_category || ' ' || milestone_stage) ILIKE '%lost%'
    )
),
bucketed AS (
  SELECT
    l.id,
    CASE
      WHEN /* closed + lost */ THEN 'closed_lost'
      WHEN /* decision + lost */ THEN 'decision_lost'
      WHEN /* experience + design + lost */ THEN 'exp_design_lost'
      WHEN /* connection + lost */ THEN 'connection_lost'
      WHEN /* discovery + lost */ THEN 'discovery_lost'
      WHEN /* fresh lead + lost OR presales lost fresh */ THEN 'fresh_lead_lost'
      ELSE 'discovery_lost'
    END AS stage_key
  FROM scoped_leads l
)
SELECT stage_key, COUNT(*) AS count
FROM bucketed
GROUP BY stage_key;
```

Compute `dropPercent` in application layer after all 6 counts are known.

---

## 7. Validation rules

Backend should enforce before response:

1. `lostFunnel.stages.length === 6`
2. Stage keys match §4 exactly and in order
3. `lostFunnel.total === SUM(stages[].count)`
4. Each `dropPercent` ≈ `round(count / total * 100)` (±1 OK on last stage)
5. All `count` values are non-negative integers
6. No currency / `value` fields in lost funnel payload

---

## 8. Frontend mapping

| UI element | Response path |
|------------|---------------|
| Lost Funnel toggle count `(1,161)` | `lostFunnel.total` |
| Red funnel bars (6 stages) | `lostFunnel.stages[]` |
| Count text e.g. `209 Lost Leads` | `stages[].count` |
| Drop % on right | `stages[].dropPercent` |
| Stage title | `stages[].stageLabel` |

If `lostFunnel` is missing or `stages` is empty, frontend shows: *"Lost funnel data not available yet."*

---

## 9. Acceptance checklist

- [x] `lostFunnel` returned on dashboard for all filter combinations
- [x] Classification via `CrmInsightsLostSegmentClassifier` (matches `lead-lost-segment.ts`)
- [x] Six stages always present in fixed order
- [x] No INR values in lost funnel response
- [x] `total` equals sum of stage counts
- [x] `dropPercent = round(count / total × 100)`
- [x] Same dashboard filters (dateRange, branch, manager, exec, role scope)
- [x] `dropReasons` independent of `lostFunnel.total`
- [ ] QA: Totals match Lost Segment tile counts on Leads page (same branch / date / assignee)

---

## 10. Sample curl

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://hub.example.com/v1/crm/insights/dashboard?dateRange=6m&branchId=1" \
  | jq '.lostFunnel'
```

Expected:

```json
{
  "total": 1161,
  "stages": [
    { "stageKey": "fresh_lead_lost", "stageLabel": "Fresh Lead Lost", "count": 325, "dropPercent": 28 },
    { "stageKey": "discovery_lost", "stageLabel": "Discovery Lost", "count": 290, "dropPercent": 25 },
    { "stageKey": "connection_lost", "stageLabel": "Connection Lost", "count": 209, "dropPercent": 18 },
    { "stageKey": "exp_design_lost", "stageLabel": "Exp & Design Lost", "count": 174, "dropPercent": 15 },
    { "stageKey": "decision_lost", "stageLabel": "Decision Lost", "count": 116, "dropPercent": 10 },
    { "stageKey": "closed_lost", "stageLabel": "Closed Lost", "count": 47, "dropPercent": 4 }
  ]
}
```

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-07-27 | Initial handoff — replace frontend placeholder ratios with real `lostFunnel` from dashboard API |
| 2026-07-27 | Hub shipped `lostFunnel` (`CrmInsightsLostSegmentClassifier`, `buildLostFunnel()`); frontend already wired |

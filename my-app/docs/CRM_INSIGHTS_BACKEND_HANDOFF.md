# CRM Insights Dashboard — Backend Handoff

**Status:** Hub Phase 1 implemented · Frontend wired to `/api/crm/insights/*`  
**Audience:** Hub / Spring backend team (`Project-ERP`)  
**Frontend repo:** `CrmInceneration/my-app`  
**UI route:** `/Insights`  
**Related filters:** Booking & Token date filter (`booking-token-date-filter.ts`)  
**Note:** `branchId` is Hub **branch code string** (e.g. `HBR`), not numeric FK.

---

## 1. Executive summary

The **CRM Insights** page needs **live aggregated analytics** (currently hardcoded mock data).

Product needs:

| Filter | Behaviour |
|--------|-----------|
| **Date** | Same contract as Booking & Token: `all`, `6m`, `custom` (+ optional presets below) |
| **Location** | Filter by **branch** |
| **Sales people** | Filter by **Sales Manager → their team**, or a single **Sales Executive** |
| **Export PDF** | **Not required** in this phase |

**Recommendation:** One primary dashboard endpoint that returns all Insight widgets in one response, plus two small lookup endpoints for filter dropdowns.

---

## 2. How many APIs?

### Required (Phase 1)

| # | Hub endpoint | Purpose |
|---|--------------|---------|
| 1 | `GET /v1/crm/insights/dashboard` | Full Insights page payload (KPIs + charts + tables) |
| 2 | `GET /v1/crm/insights/filter-options` | Branches + sales managers + executives for dropdowns |

### Out of scope (Phase 1)

| Feature | Status |
|---------|--------|
| `GET /v1/crm/insights/export-pdf` | **Do not build** — Export PDF button stays UI-only / disabled for now |
| Separate per-widget endpoints | Optional later for performance; not required for first ship |

Frontend BFF proxy (Next.js) will mirror Hub as:

```
GET /api/crm/insights/dashboard
GET /api/crm/insights/filter-options
```

---

## 3. Shared filter query parameters

All Insights dashboard queries use the same filter set.

### 3.1 Date filter (match Booking & Token)

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `dateRange` | string | No | Preset. Omit or empty = **All** (no date filter) |
| `dateFrom` | ISO datetime or `YYYY-MM-DD` | No | Used when `dateRange=custom` (or as override) |
| `dateTo` | ISO datetime or `YYYY-MM-DD` | No | Used when `dateRange=custom` (or as override) |

**Allowed `dateRange` values** (align with Booking & Token Hub params):

| Value | Meaning |
|-------|---------|
| *(omit)* / `all` | No date filter — all time |
| `3m` | Last 3 months (rolling) |
| `6m` | Last 6 months (rolling) |
| `1y` | Last 1 year (rolling) |
| `previous_month` | Full previous calendar month |
| `custom` | Use `dateFrom` / `dateTo` |

**Semantics (must match Booking & Token):**

1. Inclusive range in **server timezone**.
2. Only `dateFrom` → `field >= startOfDay(dateFrom)`.
3. Only `dateTo` → `field <= endOfDay(dateTo)`.
4. Both set → inclusive window; if `from > to`, swap them.
5. Apply date filter on lead **`createdAt`** unless noted otherwise per metric.
6. **Comparison / trend** values (e.g. `+12.5%`) = current period vs **previous equal-length period**.

**Examples:**

```http
GET /v1/crm/insights/dashboard?dateRange=6m
GET /v1/crm/insights/dashboard?dateRange=all
GET /v1/crm/insights/dashboard?dateRange=custom&dateFrom=2026-01-01&dateTo=2026-03-31
```

---

### 3.2 Location filter (branch)

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branchId` | number / string | No | Filter by branch. Omit / empty / `all` = all branches |

Leads / deals must be scoped to the selected branch (same branch field used elsewhere in CRM: `branchId` / experience center / office).

---

### 3.3 Sales people filter

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `salesManagerId` | number | No | Restrict to that manager’s **team** (all executives under the manager) |
| `salesExecutiveId` | number | No | Restrict to **one** executive |

**Rules:**

| Client sends | Backend applies |
|--------------|-----------------|
| Neither | All salespeople (subject to role permissions) |
| `salesManagerId` only | Aggregate for that manager’s team |
| `salesExecutiveId` only | That executive only |
| Both | Prefer **executive** (manager id may be ignored, or validate executive belongs to manager → `400` if mismatch) |

**Role visibility (must enforce on server):**

| Caller role | Default scope |
|-------------|---------------|
| `SUPER_ADMIN` / `SALES_ADMIN` | All branches / all teams (filters optional) |
| `SALES_MANAGER` | Own team only; `salesManagerId` forced to self if omitted |
| `SALES_EXECUTIVE` | Own data only; ignore manager/executive filters that expand scope |

---

### 3.4 Team matrix period toggle

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `teamPeriod` | `daily` \| `monthly` | No | Default `monthly`. Controls **Team Performance Matrix** aggregation only |

---

## 4. Endpoint 1 — Dashboard

```
GET /v1/crm/insights/dashboard
```

### Query params

`dateRange`, `dateFrom`, `dateTo`, `branchId`, `salesManagerId`, `salesExecutiveId`, `teamPeriod`

### Response shape

Return **raw numbers** (counts, amounts in INR, percentages as numbers). Frontend formats `₹84.2M`, `+12.5%`, etc.

```json
{
  "filtersApplied": {
    "dateRange": "6m",
    "dateFrom": "2025-12-13T00:00:00.000Z",
    "dateTo": "2026-06-13T23:59:59.999Z",
    "branchId": null,
    "salesManagerId": null,
    "salesExecutiveId": null,
    "teamPeriod": "monthly"
  },
  "kpis": {
    "totalLeads": {
      "value": 1284,
      "changePercent": 12.5,
      "progressRatio": 0.8
    },
    "pipelineValue": {
      "value": 84200000,
      "changeAbsolute": 2400000,
      "progressRatio": 0.92
    },
    "closedWon": {
      "value": 12800000,
      "changePercent": -3.1,
      "progressRatio": 0.4
    },
    "conversionPercent": {
      "value": 18.4,
      "changePercent": 0.8,
      "progressRatio": 0.25
    }
  },
  "salesFunnel": [
    {
      "stageKey": "discovery",
      "stageLabel": "Discovery",
      "count": 1284,
      "countLabel": "Leads",
      "value": 240000000,
      "conversionPercent": 100
    },
    {
      "stageKey": "connection",
      "stageLabel": "Connection",
      "count": 842,
      "countLabel": "Leads",
      "value": 180000000,
      "conversionPercent": 65.6
    },
    {
      "stageKey": "exp_design",
      "stageLabel": "Exp & Design",
      "count": 412,
      "countLabel": "Leads",
      "value": 110000000,
      "conversionPercent": 48.9
    },
    {
      "stageKey": "decision",
      "stageLabel": "Decision",
      "count": 186,
      "countLabel": "Leads",
      "value": 45000000,
      "conversionPercent": 45.1
    },
    {
      "stageKey": "closed_won",
      "stageLabel": "Closed Won",
      "count": 94,
      "countLabel": "Deals",
      "value": 12800000,
      "conversionPercent": 50.5
    }
  ],
  "revenueDistribution": {
    "phases": [
      { "phaseKey": "design", "phaseLabel": "Design Phase", "value": 38400000, "percent": 45 },
      { "phaseKey": "quotation", "phaseLabel": "Quotation", "value": 22100000, "percent": 26 },
      { "phaseKey": "fabrication", "phaseLabel": "Fabrication", "value": 15300000, "percent": 18 },
      { "phaseKey": "installation", "phaseLabel": "Installation", "value": 8400000, "percent": 11 }
    ],
    "observation": "Concentration is high in Design Phase. Fabrication timelines are currently the primary bottleneck for revenue realization."
  },
  "dropReasons": {
    "total": 326,
    "items": [
      { "reason": "Budget Mismatch", "count": 142, "percent": 42 },
      { "reason": "Competitor Selected", "count": 86, "percent": 25 },
      { "reason": "Timeline Conflict", "count": 48, "percent": 14 },
      { "reason": "Location Constraints", "count": 32, "percent": 9 }
    ]
  },
  "stageVelocity": [
    {
      "fromStage": "Discovery",
      "toStage": "Connection",
      "avgDays": 1.2,
      "trendDays": -0.4
    },
    {
      "fromStage": "Connection",
      "toStage": "Design Meeting",
      "avgDays": 4.5,
      "trendDays": 1.2
    },
    {
      "fromStage": "Design",
      "toStage": "Proposal",
      "avgDays": 7.8,
      "trendDays": -2.1
    },
    {
      "fromStage": "Proposal",
      "toStage": "Closed Won",
      "avgDays": 14.2,
      "trendDays": 0
    }
  ],
  "teamPerformance": [
    {
      "userId": 101,
      "name": "Arjun Sharma",
      "role": "Senior Associate",
      "leads": 242,
      "meetings": 118,
      "proposals": 45,
      "closed": 18,
      "closedValue": 4200000,
      "conversionPercent": 21.4
    },
    {
      "userId": 102,
      "name": "Priya Verma",
      "role": "Key Accounts",
      "leads": 198,
      "meetings": 94,
      "proposals": 38,
      "closed": 14,
      "closedValue": 3800000,
      "conversionPercent": 19.2
    },
    {
      "userId": 103,
      "name": "Rohan Mehta",
      "role": "Associate",
      "leads": 312,
      "meetings": 102,
      "proposals": 29,
      "closed": 9,
      "closedValue": 2100000,
      "conversionPercent": 8.8
    }
  ],
  "leadsOverTime": {
    "changePercent": 14,
    "points": [
      { "label": "MON", "count": 18 },
      { "label": "TUE", "count": 28 },
      { "label": "WED", "count": 26 },
      { "label": "THU", "count": 40 },
      { "label": "FRI", "count": 34 },
      { "label": "SAT", "count": 52 },
      { "label": "SUN", "count": 46 }
    ]
  },
  "conversionTrend": {
    "changePercent": -2,
    "points": [
      { "label": "WEEK 1", "conversionPercent": 16.2 },
      { "label": "WEEK 2", "conversionPercent": 17.8 },
      { "label": "WEEK 3", "conversionPercent": 15.1 },
      { "label": "WEEK 4", "conversionPercent": 18.4 }
    ]
  },
  "revenueForecast": {
    "target": 15000000,
    "actual": 12800000,
    "projected": 14500000
  }
}
```

---

## 5. Metric definitions (for backend calculation)

### 5.1 KPIs

| Field | Definition |
|-------|------------|
| `totalLeads.value` | Count of leads in filter scope for selected period |
| `totalLeads.changePercent` | % change vs previous equal period |
| `pipelineValue.value` | Sum of open pipeline deal/lead values (not closed lost) |
| `pipelineValue.changeAbsolute` | Absolute INR change vs previous period |
| `closedWon.value` | Sum of Closed Won deal value in period |
| `closedWon.changePercent` | % change vs previous period |
| `conversionPercent.value` | `(closedWonCount / totalLeads) * 100` (or product-approved formula) |
| `*.progressRatio` | Optional 0–1 for UI progress bar; can be `null` if unused |

### 5.2 Sales funnel

Ordered stages: **Discovery → Connection → Exp & Design → Decision → Closed Won**.

| Field | Definition |
|-------|------------|
| `count` | Leads/deals currently in or that reached that stage in period (confirm with product: **reached** vs **currently in**) |
| `value` | Sum of associated budget / deal value |
| `conversionPercent` | Stage-to-stage conversion: `currentCount / previousStageCount * 100` (Discovery = 100) |

Use existing CRM milestone stage keys if available.

### 5.3 Revenue distribution

Share of pipeline/revenue by project phase:

`Design Phase`, `Quotation`, `Fabrication`, `Installation`.

`percent` values should sum to ~100 (allow 1% rounding).

`observation` may be:

- static server message, or
- simple rule-based text (highest phase + named bottleneck), or
- `null` (frontend can hide the quote box)

### 5.4 Drop reason analysis

Lost / dropped leads in period, grouped by drop reason.

| Field | Definition |
|-------|------------|
| `total` | Sum of all drop counts |
| `items[].percent` | `count / total * 100` |

### 5.5 Stage velocity

Average days to move between stages.

| Field | Definition |
|-------|------------|
| `avgDays` | Mean days for transitions completed in selected period |
| `trendDays` | `currentAvg - previousPeriodAvg` (negative = faster = good) |

### 5.6 Team performance matrix

One row per salesperson in scope.

| Field | Definition |
|-------|------------|
| `leads` | Leads assigned / handled |
| `meetings` | Meetings conducted |
| `proposals` | Proposals sent |
| `closed` | Closed won count |
| `closedValue` | Closed won INR |
| `conversionPercent` | `(closed / leads) * 100` |
| `teamPeriod` | `daily` or `monthly` window for this table |

When `salesExecutiveId` is set, return **0 or 1** rows for that person.

When `salesManagerId` is set, return **team executives under that manager**.

### 5.7 Charts

| Block | Bucketing |
|-------|-----------|
| `leadsOverTime` | For short ranges (≤ 7–14 days): day labels. For longer ranges: week or month buckets — return consistent `label` + `count` |
| `conversionTrend` | Ordered period buckets with conversion % |
| `revenueForecast` | `actual` = closed/recognized in period; `projected` = forecast to period end; `target` = configured target |

---

## 6. Endpoint 2 — Filter options

```
GET /v1/crm/insights/filter-options
```

Optional: `branchId` to narrow executives list.

### Response

```json
{
  "datePresets": [
    { "id": "all", "label": "All" },
    { "id": "3m", "label": "Last 3 months" },
    { "id": "6m", "label": "Last 6 months" },
    { "id": "1y", "label": "Last 1 year" },
    { "id": "previous_month", "label": "Previous month" },
    { "id": "custom", "label": "Custom range" }
  ],
  "branches": [
    { "id": 1, "name": "Mumbai - Andheri" },
    { "id": 2, "name": "Pune - Baner" }
  ],
  "salesManagers": [
    {
      "id": 10,
      "name": "Neha Kapoor",
      "branchId": 1,
      "executives": [
        { "id": 101, "name": "Arjun Sharma", "role": "Senior Associate" },
        { "id": 102, "name": "Priya Verma", "role": "Key Accounts" }
      ]
    }
  ],
  "salesExecutives": [
    { "id": 101, "name": "Arjun Sharma", "role": "Senior Associate", "managerId": 10, "branchId": 1 },
    { "id": 102, "name": "Priya Verma", "role": "Key Accounts", "managerId": 10, "branchId": 1 },
    { "id": 103, "name": "Rohan Mehta", "role": "Associate", "managerId": 11, "branchId": 2 }
  ]
}
```

**UI behaviour this enables:**

1. Location dropdown → branches  
2. Salespeople dropdown →  
   - “All Salespeople”  
   - Group by **Sales Manager** (select manager = whole team)  
   - Nested / flat list of **Sales Executives** under each manager  

Respect caller role (managers only see own team; executives may get empty manager list).

---

## 7. Auth & errors

| Case | HTTP | Body |
|------|------|------|
| Unauthenticated | `401` | `{ "error": "Unauthorized" }` |
| Forbidden scope | `403` | `{ "error": "Forbidden" }` |
| Invalid `dateRange` | `400` | `{ "error": "Invalid dateRange", "allowed": ["all","3m","6m","1y","previous_month","custom"] }` |
| `custom` without dates | `400` | `{ "error": "dateFrom or dateTo required when dateRange=custom" }` |
| Executive not under manager | `400` | `{ "error": "salesExecutiveId does not belong to salesManagerId" }` |
| Unknown branch | `400` | `{ "error": "Invalid branchId" }` |

---

## 8. Example requests

**All time, all branches, all salespeople**

```http
GET /v1/crm/insights/dashboard
```

**Last 6 months + one branch + one manager’s team**

```http
GET /v1/crm/insights/dashboard?dateRange=6m&branchId=1&salesManagerId=10&teamPeriod=monthly
```

**Custom dates + one executive**

```http
GET /v1/crm/insights/dashboard?dateRange=custom&dateFrom=2026-01-01&dateTo=2026-03-31&salesExecutiveId=101
```

**Filter dropdowns**

```http
GET /v1/crm/insights/filter-options
```

---

## 9. Frontend mapping (UI sections)

| UI section | Response path |
|------------|---------------|
| Header filters | Query params + `/filter-options` |
| Total Leads / Pipeline / Closed Won / Conversion cards | `kpis.*` |
| Sales Funnel Efficiency | `salesFunnel` |
| Revenue Distribution | `revenueDistribution` |
| Drop Reason Analysis | `dropReasons` |
| Stage Velocity | `stageVelocity` |
| Team Performance Matrix | `teamPerformance` + `teamPeriod` |
| Leads Over Time | `leadsOverTime` |
| Conversion Trend | `conversionTrend` |
| Revenue Forecast | `revenueForecast` |
| Export PDF | **Skip** — no API |

---

## 10. Acceptance checklist

- [ ] `dateRange=all` returns unscoped-by-date aggregates  
- [ ] `dateRange=6m` matches Booking & Token 6-month window semantics  
- [ ] `dateRange=custom` with `dateFrom` / `dateTo` works  
- [ ] `branchId` filters all widgets consistently  
- [ ] `salesManagerId` returns team-scoped aggregates + team matrix rows  
- [ ] `salesExecutiveId` returns that executive only  
- [ ] Role scoping cannot be bypassed by query params  
- [ ] Amounts are numeric INR (not pre-formatted strings)  
- [ ] Trends compare against previous equal-length period  
- [ ] No PDF export endpoint in Phase 1  

---

## 11. Notes for Hub implementers

1. Prefer reusing existing lead milestone, assignee, branch, and closed-won data already used by CRM lists / Booking Token.  
2. Keep one dashboard response for Phase 1 so frontend can replace mock sections in one fetch.  
3. If aggregation is heavy, cache per `(userId, filter hash)` for 1–5 minutes — optional.  
4. Confirm with product whether funnel counts are **currently in stage** vs **entered stage in period** before locking SQL.  

---

**Contact:** Frontend team — Insights page at `my-app/app/Insights` and components under `my-app/app/Components/Insights/`.

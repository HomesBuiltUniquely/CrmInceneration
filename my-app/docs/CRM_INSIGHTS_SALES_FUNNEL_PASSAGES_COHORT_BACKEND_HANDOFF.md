# CRM Insights — Sales Funnel Passages (New/Old) + Cohort

**Status:** ✅ **Hub shipped** (Sep 2026) · FE wired  
**Audience:** Hub / Spring backend (`Project-ERP`) + FE/QA  
**Frontend repo:** `CrmInceneration/my-app`  
**BFF proxies:**
- `GET /api/crm/insights/sales-funnel` → `GET /v1/crm/insights/sales-funnel`
- `GET /api/crm/insights/passages-trend` → `GET /v1/crm/insights/passages-trend`  
**UI route:** `/Insights` → Sales Funnel widget (Passages / Cohort = Super Admin WIP preview)  
**Related FE docs:** [`INSIGHTS.md`](./INSIGHTS.md)

---

## Hub implementation summary (landed)

| Area | Shipped behavior |
|------|------------------|
| **Passages** | `newCount` / `oldCount` / share % per stage; `conversion` block; Discovery-base %; `pathFilter` ignored |
| **Cohort** | Live reach (`Instant.now()`); `conversion.overallPercent`; `cohortProgress` + IST `asOfLabel` |
| **Passages trend** | Trailing 12 months, oldest→newest, stage-entry sums, scope filters only |
| **Timezone** | `Asia/Kolkata` for date bounds + `definitions.timezone` |
| **Scope** | Shared `resolveScope()` + `CrmInsightsTransitionScopeFilter` (assignee fallback on transitions) |
| **Cache** | `Cache-Control: no-store` on funnel + trend |

**Hub files:** `CrmInsightsSalesFunnelService`, `CrmInsightsPassagesTrendService`, `CrmInsightsDateRangeResolver`, `CrmInsightsDashboardService`, `CrmInsightsController`

**Product decisions (implemented):**

1. **`dateRange=all`** → all Passages entries classify as **old** (`newCount=0`)
2. **Closed** → **Closed Won** checkpoint only
3. **Cohort terminal** → Lost + Hold + Closed Won = final; else in-progress

---

## Endpoint parameter matrix

Both endpoints use `CrmInsightsDashboardService.resolveScope()` — same role locks as dashboard.

| Param | Passages funnel | Cohort funnel | Passages trend |
|-------|-----------------|---------------|----------------|
| `branchId` | ✅ team assignee labels | ✅ `filterLeads` | ✅ team assignee labels |
| `salesManagerId` | ✅ | ✅ | ✅ |
| `salesExecutiveId` | ✅ | ✅ | ✅ |
| `dateRange` / `dateFrom` / `dateTo` | ✅ (`enteredAt`) | ✅ (`createdAt`) | ❌ trailing `months` only |
| `pathFilter` | ❌ ignored (always all) | ✅ won/lost/hold | N/A |
| `funnelMode` | `passages` | `cohort` | N/A |

**Role locks:** SE → self only · SM → own team · ADMIN/SALES_ADMIN → full org scope.

---

## 1. Summary

**Current mode is unchanged** on Hub (FE still uses journey-aligned inventory for Current). Passages / Cohort / trend are Hub-authoritative:

| Mode | Hub delivers |
|------|----------------|
| **Passages** | New vs Old split per stage + Discovery→Closed conversion + trend |
| **Cohort** | Live cohort reach + in-progress vs final split |
| **Current** | No Hub change (FE inventory) |

Frontend (Sep 2026):

- Renamed mode label **New leads → Cohort**
- Passages UI: **All / New / Old** toggle (client-side slice from Hub counts)
- Discovery→Closed summary cards (Hub `conversion`; FE fallback only if block missing)
- Conversion % from **Discovery onward** (Fresh Lead excluded from ratio chain)
- Cohort: **“Live snapshot as of today”** label + optional `cohortProgress` cards
- Passages: no Won/Lost/Hold path filter (unchanged)

---

## 2. Endpoint (unchanged URL)

```http
GET /v1/crm/insights/sales-funnel
  ?dateRange=current_month|all|3m|6m|1y|previous_month|custom
  &dateFrom=YYYY-MM-DD
  &dateTo=YYYY-MM-DD
  &branchId=HBR
  &salesManagerId=
  &salesExecutiveId=
  &funnelMode=passages|cohort
  &pathFilter=all|won|lost|hold   # omit for passages (FE does not send)
Authorization: Bearer <token>
```

**501 behavior (unchanged):** When stage transition history is empty, return `501` with `passagesAvailable: false` and a message. FE shows amber banner.

**Caching:** **No caching.** Responses must reflect live lead movement on every request (`Cache-Control: no-store`).

---

## 3. Passages mode — business rules

### 3.1 Base count (unchanged)

Count **stage-entry events** where `stageEnteredAt` (or equivalent) falls **inside** the selected date filter window (inclusive, server timezone).

Each event = one lead entering a milestone in the period (old leads moving forward **and** new leads entering both count).

### 3.2 New vs Old classification (NEW — Hub must compute)

For **each stage-entry event** counted in Passages:

| Class | Rule |
|-------|------|
| **new** | Lead `createdAt` is **inside** the same selected date range (inclusive) |
| **old** | Lead `createdAt` is **strictly before** the range start |

**Critical:**

- Use **`Asia/Kolkata`** (or echo in `definitions.timezone`) for **both** the date filter window **and** `createdAt` comparison — same boundary as Insights dashboard date filter.
- Works for **all** presets: This month, Previous month, 3m, 6m, 1y, All, Custom — boundary is always “inside vs before **current filter range**”, not hardcoded calendar month.
- Edge case QA: lead created at 23:59 on last day of range must classify as **new**, not old.

Per stage return:

```json
{
  "stageKey": "discovery",
  "stageLabel": "Discovery",
  "count": 40,
  "newCount": 28,
  "oldCount": 12,
  "newSharePercent": 70,
  "oldSharePercent": 30,
  "sharePercent": 59
}
```

| Field | Rule |
|-------|------|
| `count` | Combined total (`newCount + oldCount`) — **unchanged semantics** |
| `newSharePercent` | `newCount / count * 100` when `count > 0` |
| `oldSharePercent` | `oldCount / count * 100` when `count > 0` |

### 3.3 Total bar (unchanged)

Synthetic **Total** row: combined counts only — **no** `newCount` / `oldCount` on Total.

### 3.4 Conversion % base (CHANGED for Passages + Cohort)

| Stage | Conversion % |
|-------|----------------|
| **Total** | 100% |
| **Fresh Lead** | Omit from chain (FE shows `—`) |
| **Discovery** | 100% (base) |
| **Connection → Closed** | `stageSegmentCount / discoverySegmentCount * 100` |

Segment = combined, new-only, or old-only depending on FE toggle (Hub returns all three via `conversion` block).

**Do not** chain conversion from Fresh Lead.

---

## 4. Passages — `conversion` summary block (NEW)

Add top-level object on `funnelMode=passages` responses:

```json
{
  "conversion": {
    "baseStage": "discovery",
    "overallPercent": 34,
    "newPercent": 41,
    "oldPercent": 22
  }
}
```

| Field | Meaning |
|-------|---------|
| `baseStage` | Always `"discovery"` for v1 |
| `overallPercent` | Closed segment count / Discovery segment count (combined) |
| `newPercent` | Same ratio using **new** counts only |
| `oldPercent` | Same ratio using **old** counts only |

**Definition:** “Closed” = canonical closed/won milestone. “Discovery” = discovery milestone entries in range (Passages) or cohort reach counts (Cohort — see §5).

Frontend prefers Hub values; falls back to FE calculation from stage rows if block missing.

---

## 5. Cohort mode — confirm + harden

### 5.1 Business rule (existing — confirm correct)

- Denominator = leads **`createdAt` inside** selected date range (same scope filters).
- Each stage `count` = how many of those cohort leads have **reached** that milestone **as of request time** (live inventory of cohort progress).
- Not Passages (entries in range); not Current (everyone sitting now regardless of created date).

### 5.2 Live data requirement

- No response caching.
- Stage movement between requests must appear on next GET.
- FE labels UI **“Live snapshot as of today”**.

### 5.3 Conversion base (same as Passages)

Discovery onward; Fresh Lead excluded from conversion chain; Total unchanged.

Include `conversion.overallPercent` on cohort responses (`newPercent` / `oldPercent` optional / omit).

### 5.4 Optional `cohortProgress` block (recommended)

```json
{
  "cohortProgress": {
    "inProgressCount": 18,
    "finalOutcomeCount": 10,
    "inProgressPercent": 64,
    "finalOutcomePercent": 36,
    "asOfLabel": "2 Sep 2026, 4:30 PM IST"
  }
}
```

| Field | Meaning |
|-------|---------|
| `inProgressCount` | Cohort leads still on active won-path (not closed won / lost / hold) |
| `finalOutcomeCount` | Cohort leads with terminal outcome (won + lost + hold) |
| Percents | Share of cohort total |
| `asOfLabel` | Human-readable snapshot time in `definitions.timezone` |

### 5.5 Path filter (unchanged)

`pathFilter=won|lost|hold|all` still applies to Cohort. Passages ignores path filter.

---

## 6. Full response example — Passages

```json
{
  "funnelMode": "passages",
  "pathFilter": "all",
  "passagesAvailable": true,
  "passagesUnavailableReason": null,
  "definitions": {
    "dateField": "stageEnteredAt",
    "reachRule": "count stage entry events in filter window",
    "timezone": "Asia/Kolkata"
  },
  "total": {
    "count": 46,
    "sharePercent": 100,
    "countLabel": "Entries"
  },
  "conversion": {
    "baseStage": "discovery",
    "overallPercent": 34.2,
    "newPercent": 41.0,
    "oldPercent": 22.5
  },
  "stages": [
    {
      "stageKey": "total",
      "stageLabel": "Total",
      "count": 46,
      "sharePercent": 100
    },
    {
      "stageKey": "fresh_lead",
      "stageLabel": "Fresh Lead",
      "count": 28,
      "newCount": 28,
      "oldCount": 0,
      "newSharePercent": 100,
      "oldSharePercent": 0,
      "sharePercent": 61
    },
    {
      "stageKey": "discovery",
      "stageLabel": "Discovery",
      "count": 27,
      "newCount": 20,
      "oldCount": 7,
      "newSharePercent": 74,
      "oldSharePercent": 26,
      "sharePercent": 59
    },
    {
      "stageKey": "connection",
      "stageLabel": "Connection",
      "count": 5,
      "newCount": 3,
      "oldCount": 2,
      "newSharePercent": 60,
      "oldSharePercent": 40,
      "sharePercent": 11
    },
    {
      "stageKey": "closed",
      "stageLabel": "Closed",
      "count": 2,
      "newCount": 1,
      "oldCount": 1,
      "newSharePercent": 50,
      "oldSharePercent": 50,
      "sharePercent": 4
    }
  ]
}
```

---

## 7. Full response example — Cohort

```json
{
  "funnelMode": "cohort",
  "pathFilter": "all",
  "passagesAvailable": true,
  "definitions": {
    "dateField": "createdAt",
    "reachRule": "leads created in window; count current milestone reach",
    "timezone": "Asia/Kolkata"
  },
  "total": { "count": 36, "sharePercent": 100 },
  "conversion": {
    "baseStage": "discovery",
    "overallPercent": 28.5
  },
  "cohortProgress": {
    "inProgressCount": 22,
    "finalOutcomeCount": 14,
    "inProgressPercent": 61,
    "finalOutcomePercent": 39,
    "asOfLabel": "2 Sep 2026, 4:46 PM IST"
  },
  "stages": [ "... same stage shape as today; newCount/oldCount NOT required for cohort ..." ]
}
```

---

## 8. Hub implementation notes

### 8.1 Preferred data path

Compute `newCount` / `oldCount` **server-side** from stage transition history joined to lead `createdAt`. Do **not** require FE to pull per-lead rows.

### 8.2 Timezone

All date boundaries:

```java
// Pseudocode
ZoneId zone = ZoneId.of("Asia/Kolkata");
Instant rangeStart = startOfDay(dateFrom, zone);
Instant rangeEnd = endOfDay(dateTo, zone);

boolean isNew = !lead.createdAt.isBefore(rangeStart) && !lead.createdAt.isAfter(rangeEnd);
boolean isOld = lead.createdAt.isBefore(rangeStart);
```

For `dateRange=all`, define product rule explicitly (FE suggests: all entries classify as **old** unless lead created after a platform epoch — **confirm with product**).

### 8.3 Stage keys (canonical)

Align with FE `insights-funnel-stage-paths.ts`:

`fresh_lead`, `discovery`, `connection`, `exp_design`, `decision`, `closed`, `total`

### 8.4 Scope

Same P0 scope as dashboard: date + branch + sales people + role locks. Echo in response or reuse dashboard `filtersApplied` pattern.

---

## 9. Acceptance criteria (QA)

### Passages

- [ ] `count === newCount + oldCount` for every non-total stage
- [ ] Total row has no new/old fields
- [ ] New/old boundary matches filter range in `Asia/Kolkata` (boundary minute test)
- [ ] Works for: This month, Previous month, 3m, 6m, 1y, All, Custom
- [ ] `conversion.newPercent` / `oldPercent` match manual Closed÷Discovery using segment counts
- [ ] Stage conversion % uses Discovery as 100% base, not Fresh Lead
- [ ] `501` when history empty; `passagesAvailable: false`

### Cohort

- [ ] Counts update after lead stage change (no cache; re-fetch within seconds)
- [ ] Only leads created in range included
- [ ] `conversion.overallPercent` from Discovery base
- [ ] `pathFilter` still filters cohort paths
- [ ] Optional `cohortProgress` sums reconcile to cohort total

### Regression

- [ ] Current mode / dashboard funnel untouched
- [ ] Passages ignores `pathFilter` query param

---

## 10. Frontend files (for backend reference)

| File | Role |
|------|------|
| `lib/crm-insights-api.ts` | Types + normalizers for new fields |
| `lib/insights-funnel-api-display.ts` | Segment toggle + Discovery conversion FE fallback |
| `app/Components/Insights/InsightsSect3.tsx` | Passages All/New/Old UI, Cohort live label, old-share trend chart |
| `app/Components/Insights/PassagesOldShareTrendChart.tsx` | Line chart (Passages tab only) |
| `app/api/crm/insights/sales-funnel/route.ts` | BFF pass-through (no transform) |
| `app/api/crm/insights/passages-trend/route.ts` | BFF proxy for monthly trend |

---

## 11. Passages old-lead share trend (NEW endpoint)

**UI location:** Inside **Passages** tab only (`InsightsSect3`) — not Sect6 charts.

**Business question:** Over the last 12 months, what % of each month's Passages entries were **Old** leads (created before that month) vs **New**?

### 11.1 Endpoint

```http
GET /v1/crm/insights/passages-trend
  ?months=12
  &branchId=HBR
  &salesManagerId=
  &salesExecutiveId=
Authorization: Bearer <token>
```

**BFF:** `GET /api/crm/insights/passages-trend`

### 11.2 Scope rules

| Respects | Ignores |
|----------|---------|
| `branchId` | Header **date range** filter |
| `salesManagerId` / `salesExecutiveId` | `funnelMode`, `pathFilter` |
| Role locks (same as dashboard) | `teamPeriod` |

Always returns a **trailing window** of `months` calendar months (default **12**), ending at current month in `Asia/Kolkata`.

**Do not** require the frontend to loop 12 calls to `sales-funnel` with different date ranges.

### 11.3 Per-month calculation

For each calendar month `M` in the trailing window:

1. Run Passages logic for **that month only** (stage entries where `stageEnteredAt` ∈ month `M`, inclusive, IST).
2. Sum `newCount` + `oldCount` across **all milestone stages** (or use total Passages entries — **pick one and document**; FE expects combined entry totals per month).
3. `oldSharePercent = oldCount / (newCount + oldCount) * 100` when denominator > 0.

**Recommended aggregation:** Sum new/old across all stage-entry events in the month (same classification rules as §3.2).

### 11.4 Response shape

```json
{
  "hubImplemented": true,
  "months": 12,
  "timezone": "Asia/Kolkata",
  "points": [
    {
      "month": "2025-10",
      "monthLabel": "Oct 2025",
      "newCount": 120,
      "oldCount": 45,
      "oldSharePercent": 27.3
    },
    {
      "month": "2026-09",
      "monthLabel": "Sep 2026",
      "newCount": 98,
      "oldCount": 52,
      "oldSharePercent": 34.7
    }
  ]
}
```

| Field | Required |
|-------|----------|
| `points[].month` | Yes — `YYYY-MM` sortable |
| `points[].monthLabel` | Optional — short axis label |
| `points[].newCount` | Yes |
| `points[].oldCount` | Yes |
| `points[].oldSharePercent` | Yes (Hub calc preferred) |

Return **oldest → newest** or **newest → oldest** — FE renders in array order (document which).

### 11.5 Alternative (not preferred)

Embed on `sales-funnel` response when `funnelMode=passages`:

```json
"monthlyTrend": [ { "month": "2026-01", "newCount": 10, "oldCount": 5 } ]
```

FE currently calls the **dedicated** endpoint when Passages tab is active.

### 11.6 Acceptance criteria (trend)

- [ ] Single API call returns 12 monthly points
- [ ] `oldSharePercent` matches `oldCount / (newCount + oldCount)` per month
- [ ] Updates when branch / manager / executive filters change
- [ ] Does **not** change when header date filter changes
- [ ] No response caching (`Cache-Control: no-store`)
- [ ] Empty history → `points: []`, not 500

---

## 12. Fast-follow (out of v1 scope)

- Stage velocity split by new vs old
- “Stuck old leads” callout (old created > N months ago, entered stage this period)
- Export Passages New/Old table to CSV

---

## 13. Resolved product decisions (implemented in Hub)

| # | Decision | Implementation |
|---|----------|----------------|
| 1 | `dateRange=all` | All Passages entries = **old** (`newCount=0`) |
| 2 | Closed definition | **Closed Won** checkpoint only |
| 3 | Cohort in-progress | Lost + Hold + Closed Won = final; all else in-progress |

---

## 14. QA sign-off checklist

- [ ] Passages All/New/Old toggle matches Hub `newCount`/`oldCount` per stage
- [ ] Discovery→Closed matches Hub `conversion` block
- [ ] Cohort `cohortProgress` + live label reflects stage moves on re-fetch
- [ ] Passages trend: 12 points, updates on branch/people change, not on date filter
- [ ] SM / SE role locks enforced (403 when scope violated)
- [ ] Transitions with blank assignee still respect scope (fallback filter)

FE picks up JSON automatically via `lib/crm-insights-api.ts` normalizers.

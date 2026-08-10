# CRM Insights — Filter Alignment & 100% Accuracy (QA + Hub API)

**Status:** Hub **P0 filter alignment shipped** (single Scope for all dashboard sections).  
**Audience:** Hub backend, FE, QA/testers  
**UI:** `/Insights` header filters → **Date**, **Location (branch)**, **Sales people**  
**Hub API doc:** Backend `docs/CRM_INSIGHTS_DASHBOARD_API.md`  
**Goal:** Every widget reflects the **same three filters** (plus `teamPeriod` only where documented). Testers verify via Network `filtersApplied` + CRM export.

---

## 0. Hub P0 frozen rules (current)

| Rule | Behaviour |
|------|-----------|
| **A same scope** | One Scope → KPIs, funnels, drop, velocity, team matrix, all charts |
| **B manager** | Only **SALES_EXECUTIVE under manager** (no manager row; manager’s own leads out of KPI) |
| **B executive** | Exactly that user → matrix **0–1** rows, matching `userId` |
| **B both** | Prefer executive; **HTTP 400** if exec not under manager |
| **C role locks** | SE → self only; SM → own team only; admin full filters |
| **F assignee** | `lead.assignee` ⇄ `User.fullName` **or** `username` (case-insensitive) |
| **E branch** | `User.branch` code (e.g. `HBR`) |
| **I matrix fields** | Hub: `leads`, `meetings` (Appointment.createdAt + salesUserId), `proposals` (quote-sent timestamp + assignee), `closed`, `closedValue` (hidden on FE), `conversionPercent`, `active` |

`filtersApplied` also echoes: `assigneeRule`, `branchField`.

**FE:** One `/dashboard` call. **Target / Achieved / Payoff** stay FE Incentives (Hub omits them).

---

## 1. Single source of truth (intent)

| Filter | Query param | Meaning |
|--------|-------------|---------|
| **Date** | `dateRange` + optional `dateFrom` / `dateTo` | Same Booking & Token calendar rules |
| **Location** | `branchId` | Hub **branch code** (e.g. `HBR`); omit/`all` = all locations |
| **Sales people** | `salesManagerId` **or** `salesExecutiveId` | Manager = **team**; Exec = **one person** |
| **Activity period** (Team Matrix only) | `teamPeriod=daily\|monthly` | Hub Leads/Meetings/Proposals window; FE always sends `monthly`. Value column not shown |

All three primary filters must apply to KPIs, funnels, drop reasons, stage velocity, team metrics, charts, forecasts — **same scope**, unless this doc marks an exception.

---

## 2. API contract (already wired on FE)

### 2.1 Dashboard (one call for most widgets)

```http
GET /v1/crm/insights/dashboard
  ?dateRange=all|3m|6m|1y|previous_month|custom
  &dateFrom=   // ISO or YYYY-MM-DD when custom / override
  &dateTo=
  &branchId=   // branch code string, e.g. HBR
  &salesManagerId=
  &salesExecutiveId=
  &teamPeriod=daily|monthly
Authorization: Bearer <token>
```

**FE proxy:** `GET /api/crm/insights/dashboard` (pass-through query + auth).

**Echo required:**

```json
"filtersApplied": {
  "dateRange": "6m",
  "dateFrom": "...",
  "dateTo": "...",
  "branchId": "HBR",
  "salesManagerId": 12,
  "salesExecutiveId": null,
  "teamPeriod": "monthly",
  "assigneeRule": "lead.assignee matches User.fullName or username (case-insensitive)",
  "branchField": "User.branch"
}
```

Testers: open Network → confirm request params match header UI → confirm `filtersApplied` matches (incl. `assigneeRule` / `branchField`).

### 2.2 Filter options (dropdowns)

```http
GET /v1/crm/insights/filter-options
  ?branchId=HBR   // optional: narrow managers/execs to location
```

Must return:

| Field | Use |
|-------|-----|
| `branches[]` | `{ id: "HBR", name: "…" }` — **id = same code as `branchId`** |
| `salesManagers[]` | Managers in scope (+ preferably nested `executives[]`) |
| `salesExecutives[]` | Execs with `managerId` when not nested |
| Hierarchy | Selecting manager in FE only lists team execs from this payload |

**FE:** Changing Location reloads filter-options with that `branchId` so Sales people list aligns to branch.

### 2.3 No extra APIs strictly required for Team Matrix people scope

Team matrix **rows come from** `dashboard.teamPerformance`. Scope is entirely Hub:

| Header selection | FE sends | Hub returns `teamPerformance` |
|------------------|----------|-------------------------------|
| All salespeople | neither id | Active **SALES_EXECUTIVE** rows in branch/role scope |
| **Sales Manager** | `salesManagerId=N` only | **Only SALES_EXECUTIVE under manager N** — **no manager row** |
| **Sales Executive** | `salesExecutiveId=M` only | **0 or 1** row; `userId === M` |
| Both sent | Prefer executive | **400** if M not under manager |

FE does **not** invent team rows. Target/Achieved/Payoff joined by `userId` via FE Incentives only.

---

## 3. Scope rules (people) — end-to-end

### 3.1 Assignee definition (Hub must freeze one rule)

All metrics that are “this person’s leads” must use the **same** ownership field set:

Recommended (pick one, document in code):

- Primary: current `assigneeUserId` / assigned sales executive id  
- Fallback: booking/token submitter only where product defines credit  

**Same rule for:** KPIs total leads, funnel, lost, drop reasons, velocity transitions in period, team matrix `leads`/`closed`, chart series.

### 3.2 Manager = team union

When `salesManagerId` set:

```
scope = all leads assigned to { executives where managerId = N }
+ optionally leads assigned to manager if product says so (prefer: exec-only for matrix)
```

Team matrix: one row per executive in team with counts **only for that exec’s leads in scope**.  
Sum of team `leads` should equal filtered KPI total leads for that manager (when date/branch match).

### 3.3 Role hard limits (server-side, always)

| Caller | Constraint |
|--------|------------|
| `SALES_EXECUTIVE` | Force `salesExecutiveId = self`; ignore expanded filters |
| `SALES_MANAGER` | Max scope = own team; cannot select other managers’ teams |
| Admin / Sales Admin | Full branch (+ all people) as filters allow |

Without this, FE filters alone cannot guarantee security or consistency.

---

## 4. Date semantics (shared)

Must match Booking & Token:

| Rule | Detail |
|------|--------|
| Timezone | Server TZ, inclusive start/end of day |
| Field | Default filter field = lead **`createdAt`** unless metric says otherwise |
| Stage Velocity | Filter on transition **completion** (`exitedAt`), not create date |
| Team `teamPeriod=daily` | Hub matrix leads + meetings + proposals: **UTC today** only (still branch/people) |
| Team `teamPeriod=monthly` | Matrix activity uses full Insights date window |
| Trends / `% change` | Current window vs **previous equal-length** window |

**Exception — FE Incentives columns (Target / Achieved / Payoff):**

- Not from Hub dashboard aggregation  
- Current calendar month Incentives engine (Month = H1+H2 default; optional 15-day half)  
- **By design** they can differ from dashboard dateRange when dateRange ≠ “this month”  
- Document on UI: “Incentive period” vs “Activity period”

---

## 5. Location (branch)

| Rule | Detail |
|------|--------|
| Param | `branchId` = **branch code string**, not numeric DB id alone |
| Lead match | Same branch field as Booking Token / CRM lead (`branch` / experience center code) |
| Filter-options | With `branchId`, only managers/execs **for that branch** |
| Cross-check | KPI lead count for branch X ≤ all-branches count |

---

## 6. Widget map — who applies filters (tester view)

| Widget | Primary source after filter | Date | Location | People | Notes |
|--------|----------------------------|------|----------|--------|-------|
| KPI cards | Hub `kpis` | ✓ | ✓ | ✓ | |
| Sales Funnel (paths) | FE stage-path + admin lead pool **and/or** Hub funnel | ✓ | ✓ | ✓ (aliases) | Dual path — counts should match Hub when Hub funnel reliable |
| Lost funnel / Drop reasons | FE lost-segment from same lead pool | ✓ | ✓ | ✓ | Align to Lost Total |
| Stage Velocity | Hub `stageVelocity` | ✓ (exit) | ✓ | ✓ | |
| Team matrix Leads…Conv | Hub `teamPerformance` | ✓ + `teamPeriod` | ✓ | ✓ **manager→team, exec→1** | |
| Team Target/Achieved/Payoff | FE Incentives | Month/H1/H2 | Targets by user | Rows join by `userId` | Not Insights dateRange |
| Charts 5.7 | Hub `leadsOverTime`, `conversionTrend`, `revenueForecast` | ✓ | ✓ | ✓ | No FE recompute |
| Token metrics (if shown) | FE booking deals | date | **often date only** | may miss location/people | See §8 gaps |

---

## 7. Team Performance — acceptance (manager / exec)

### 7.1 Select Manager “Priya” (`salesManagerId=12`)

| Check | Expected |
|-------|----------|
| Request | `salesManagerId=12`, no `salesExecutiveId` |
| `teamPerformance` | Only Priya’s execs (userIds in team) |
| No stranger rows | No exec from other managers |
| KPI totalLeads | ≈ sum of team leads (or define known offset once) |
| Charts | Same people scope |

### 7.2 Select Executive “Akhil” (`salesExecutiveId=101`)

| Check | Expected |
|-------|----------|
| Request | `salesExecutiveId=101` only |
| `teamPerformance.length` | `0` or `1` |
| If 1 | `userId === 101` |
| All widgets | Akhil-only numbers |

### 7.3 Switch Location then re-open Sales people

| Check | Expected |
|-------|----------|
| filter-options refreshed | Execs/managers for that branch only |
| Stale selection | FE/Hub clear invalid manager/exec not in branch |
| Matrix | Only people in new branch + people filter |

---

## 8. Known FE dual-paths & accuracy risks (honest)

These are the places **not** 100% pure Hub-dashboard — testers must know:

| Area | FE behaviour | Risk if Hub ≠ FE |
|------|--------------|------------------|
| Funnel / Lost / Drop | Client loads admin sales pool + path rules | Numbers can diverge from Hub `salesFunnel` if branch/assignee match differs |
| Quote sent tiles | Client lead list + quote flags | Same |
| Token $ tiles | Booking deals by date (location/people partial) | Under/over vs Hub |
| Team incentives | Booking-weighted Incentives API | Differ from Hub closedValue by design |

**For “tester 100%” on Hub widgets:** verify via **network** `dashboard` body + CRM raw exports with same filters.

**To close dual-path gaps (Hub backlog):**  
Serve all funnel/lost/drop/tokens from **single** dashboard with **one** assignee+branch+date definition (same as matrix). FE then displays only — no second lead pool. **No new endpoint strictly required** if existing dashboard is completed; optional later: `GET /v1/crm/insights/leads-export` for audit trails.

---

## 9. Hub work checklist (if numbers fail QA)

| Priority | Item |
|----------|------|
| P0 | Apply **same** `dateRange` + `branchId` + people to **every** dashboard section |
| P0 | Manager → only direct (or documented) executive set; matrix + aggregates |
| P0 | Executive → single-user scope everywhere |
| P0 | Role hard-lock (SE sees only self) |
| P0 | `filtersApplied` exact echo |
| P1 | `filter-options?branchId=` hierarchy complete + stable ids |
| P1 | Document branch field on lead/deal used for `branchId` |
| P1 | Team `daily` vs `monthly` precise definition |
| P2 | Unify dual FE funnel path by making Hub funnel authoritative + accurate |
| P2 | Optional audit export endpoint |

**You do not need a separate Team Matrix API** if `teamPerformance` + people params already enforce §2.3.

---

## 10. Smoke test matrix (QA)

Use one browser, Network tab open, auth same as CRM.

| # | Setup | Assert |
|---|--------|--------|
| 1 | Date `all`, branch all, people all | Dashboard 200; widgets populate or legit empty |
| 2 | Date `6m` only | Counts ≤ all-time; charts labels change |
| 3 | Branch `HBR` only | Counts ≤ all branches; people dropdown only HBR people |
| 4 | Manager M | Matrix rows ⊂ M’s team only; request has `salesManagerId` |
| 5 | Then exec E under M | Matrix 0–1 row; request has `salesExecutiveId` only |
| 6 | Exec then branch other location | Exec drop or zero if not in branch |
| 7 | `teamPeriod=daily` | Matrix leads typically fall; charts still full dateRange |
| 8 | Incentive Month → 1st–15th | Only Target/Achieved/Payoff change |
| 9 | Role = SALES_EXECUTIVE | Cannot expand past self (server) |
| 10 | Compare two managers | No shared execs across matrices |

**Pass criteria:** Header filters change → request params change → visible numbers change consistently → Team Matrix people rule holds without client inventing rows.

---

## 11. FE implementation notes (current)

| Piece | Path / behaviour |
|-------|------------------|
| Filter UI | `InsightsClient.tsx` header: date / branch / sales people |
| Dashboard params | `buildInsightsDashboardSearchParams` → `salesManagerId` **or** `salesExecutiveId` |
| Team matrix | Renders Hub `teamPerformance` (+ FE incentives by `userId`) |
| Clear all | Resets date, people, location |
| Incentives period | Month \| H1 \| H2 — independent of `teamPeriod` |

---

## 12. Sign-off

| Owner | Sign-off question |
|-------|-------------------|
| Hub | Same filters on all widgets + team matrix scope rules? |
| FE | Sends only one people param; displays Hub matrix; incentives by userId? |
| QA | Smoke table §10 green on stage + sample production branch? |

When all three sign, Insights is “filter-aligned accurate” for **Hub-owned** metrics. Dual-path FE widgets remain listed in §8 until Hub owns them.

---

*Related:* `CRM_INSIGHTS_BACKEND_HANDOFF.md` (full payload shapes §4–5) · Stage velocity §5.5 · Team/charts §5.6–5.7

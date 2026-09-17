# Backend handoff: Sales Admin ↔ Sales Manager journey counts must match

**Date:** 2026-08-07  
**Frontend:** New CRM (`my-app`) Leads page / Journey Phase Heatmap  

> **2026-08-08 frontend status:** Option A path  
> `GET /v1/leads/admin/sales-manager/{id}/journey` is **not deployed** on Hub  
> (`NoResourceFoundException`). Frontend now calls SM `my-leads`/`team-leads` with  
> `salesManagerId` + act-as headers and/or `/v1/leads/filter?salesManagerId=`  
> and **does not re-filter** those rows by assignee name (that re-filter was Fresh=1).  

> **Update:** Kulwant login wrong heatmap (phases undercount vs Lead card) was a **frontend bug** — Hub `my+team` was re-filtered with incomplete display names. Fixed in frontend; **no backend change needed for that**. This doc is only if you still need Admin→SM and SM login to be *exact* twins on Hub membership.

**Owner ask (optional):** When a **Sales Admin** filters by Sales Manager **Kulwanth P** (or any SM), the journey phase counts and Total Leads must match what that **Sales Manager** sees on their own My Leads dashboard (100% same inventory).

---

## 1. Problem (observed)

| View | Fresh Lead | Discovery | Connection | Lead card | Opportunity | Notes |
|------|------------|-----------|------------|-----------|-------------|-------|
| Sales Admin → SALES MGR = Kulwanth | 4 | 555 | 187 | 746 | 229 | Phases sum correctly |
| Kulwanth logged in as Sales Manager | 4 | 468 | 169 | 756 vs phases 641 | 228 vs phases 201 | Cards ≠ phase bars (frontend bug, fixed) |

Even after frontend alignment, **Admin hierarchy scope ≠ SM JWT my+team membership** can still leave a residual gap (e.g. Discovery 555 vs ~468). That residual is a **Hub membership** issue, not UI math.

---

## 2. Authoritative count definition (frontend now)

Journey inventory is defined as:

1. **Membership pool**
   - **Sales Manager login:** Hub `GET /v1/leads/sales-manager/my-leads` ∪ `GET /v1/leads/sales-manager/team-leads` (verified CRM sales inbox), id-merged.
   - **Sales Admin → filter that SM:** today uses `GET /v1/leads/admin/sales` + BFF `assigneeAliasSet` (manager + exec aliases from hierarchy `managerId`). **This is not guaranteed equal to (1).**
2. **Dedupe for stage / Lead / Opportunity / Total Leads**
   - `pickMilestoneRepresentativeRows`: one row per phone; prefer latest-updated row that has milestone fields (**current journey**, not first-touch created_at).
3. **Stage label**
   - Canonical sales phases: Fresh Lead → Discovery → Connection → Experience & Design → Decision → Closed.
4. **Lead card** = Fresh + Discovery + Connection  
   **Opportunity card** = Experience & Design + Decision + Closed  
   **Total Leads** = length of the same journey inventory (phases must sum to cards; cards must sum to Total when no stage filter).

Frontend has been updated so **SM own dashboard** uses the same my+team + milestone-representative rule for heatmap and table. Admin→SM still depends on Hub returning the **same membership** as that manager’s my+team.

---

## 3. What we need from Hub

### Option A (preferred): Manager-scoped admin journey API

Allow Sales Admin / Super Admin to load **exactly** the same lead set the manager would see:

```http
GET /v1/leads/admin/sales-manager/{managerUserId}/journey
```

**Query (same filters as list):**

| Param | Notes |
|-------|--------|
| `verificationStatus` | Default `verified` for sales inbox |
| `leadType` / merge all types | Same as existing admin sales merge |
| `dateFrom` / `dateTo` / `dateField` | Optional |
| `milestoneStage` / category / subStage | Optional |
| `page` / `size` / `sort` | Pagination |

**Response:** Same shape as existing admin sales list (`content`, `totalElements`, stage fields on each lead).

**Membership rule (must match SM JWT):**

- Include leads the manager would get from **my-leads** (assigned to manager).
- Include leads the manager would get from **team-leads** (assigned to executives in that manager’s team).
- **Do not** use a different “hierarchy alias guess” than the team membership Hub already uses for `team-leads`.

Optional companion counts endpoint:

```http
GET /v1/leads/admin/sales-manager/{managerUserId}/milestone-counts
```

Return `countsByMilestoneStage` using **current** `milestoneStage` (not first-touch).

### Option B: Impersonation / act-as

```http
GET /v1/leads/sales-manager/my-leads
GET /v1/leads/sales-manager/team-leads
Header: X-Act-As-User-Id: {managerUserId}
```

(or equivalent JWT claim) for callers with `SALES_ADMIN` / `SUPER_ADMIN`.  
Frontend can then reuse the exact SM combined merge path.

### Option C (minimum): Document + expose team membership

If A/B are delayed, Hub must guarantee:

1. `admin/sales` filtered by assignee list **equals** `my-leads ∪ team-leads` for that manager when the assignee list is the **official team roster** returned by Hub.
2. Provide:

```http
GET /v1/users/sales-managers/{managerUserId}/team
```

with stable user ids + display names used on lead `assignee` fields (no nickname drift).

---

## 4. Acceptance tests (backend)

Use one known manager (e.g. Kulwanth P / userId `M`).

| # | Check |
|---|--------|
| 1 | As manager JWT: `count(my-leads ∪ team-leads)` after id-merge = `N`. |
| 2 | As admin JWT: Option A/B returns the **same N** lead ids (set equality). |
| 3 | Stage histogram on that set (current `milestoneStage`) matches between SM and Admin responses. |
| 4 | Filtering `milestoneStage=Discovery` returns the same Discovery count both ways. |
| 5 | No double-count: same phone with two lead types → journey dedupe uses **one** current-milestone row (document which row wins: latest `updatedAt` with milestone preferred). |

---

## 5. What frontend already did

- SM heatmap now loads **my + team** (`roleView`) like the table (was incorrectly using filter merge + `leadView=default` only).
- Sales journey Total / Lead / Opportunity / phases use **`pickMilestoneRepresentativeRows`** (current milestone per phone), not first-touch primary.
- Lead/Opportunity card totals use the **same canonical stage map** as phase bars.
- Sales Admin + Sales Manager hierarchy filter syncs heatmap from that journey inventory.

**Remaining gap without Hub Option A/B:** Admin pool membership via hierarchy aliases can still differ from Hub’s official `team-leads` roster → Discovery/Connection totals may still diverge slightly until Hub exposes the manager-scoped set.

---

## 6. Contacts / code pointers

| Area | Path |
|------|------|
| SM combined fetch | `LeadsDataSection.tsx` → `fetchMergedPage` (`roleView=my` + `team`) |
| SM heatmap fetch | `JourneyPhaseHeatmap.tsx` → `loadMilestoneCounts` |
| Journey dedupe | `lib/primary-source-leads.ts` → `pickMilestoneRepresentativeRows` |
| Admin SA filter | `lib/admin-leads-api.ts` + `/api/crm/admin/sales` |
| Existing mismatch notes | `docs/CRM_FILTERS_AND_COUNT_MISMATCH.md` |

---

## 7. Ask to backend

Please implement **Option A** (or B) so:

> `Sales Admin → select Sales Manager X` journey counts === `Sales Manager X` My Leads journey counts  
> (same lead id set, same current milestone stage histogram).

Until then, frontend can only align math/dedupe; it cannot invent Hub team membership that JWT my/team endpoints use.

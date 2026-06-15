# CRM Date Filter by Field — Backend Handoff

**Status (2026-06-13):** Hub filter + **`meetingDate` PUT** shipped in Project-ERP — deploy + SQL backfill, then QA  
**Audience:** Hub / Spring backend team  
**Frontend repo:** `CrmInceneration/my-app` (Next.js BFF proxies to Hub)

---

## 1. Executive summary

Today, CRM toolbar **From / To** dates filter leads by **creation date** (`createdAt`).  
Product needs the **same date range UI** to filter by:

| Manager question | Filter should use |
|------------------|-------------------|
| “Next week how many **meetings** are scheduled?” | `meetingDate` |
| “On 15 June how many **follow-ups** do we have?” | `followUpDate` |
| “Next week in **Connection** stage — how many follow-ups / meetings?” | `followUpDate` or `meetingDate` + milestone |

**Recommendation:** Extend **existing list + counts APIs** with one new query param: **`dateField`**.  
**Do not** add a separate “follow-up API” or “meeting API” unless you later want a dedicated analytics endpoint (optional Phase 2).

---

## 2. How many APIs?

### Required (Phase 1): **8 existing Hub endpoints** — extend, do not replace

| # | Hub endpoint | Used by | Must support `dateField` |
|---|--------------|---------|---------------------------|
| 1 | `GET /v1/leads/filter` | Sales exec, manager JWT list, merged lead types | **Yes** |
| 2 | `GET /v1/leads/presales-search` | Presales exec / manager inbox | **Yes** |
| 3 | `GET /v1/leads/sales-manager/my-leads` | Sales manager “My leads” view | **Yes** |
| 4 | `GET /v1/leads/sales-manager/team-leads` | Sales manager “Team leads” view | **Yes** |
| 5 | `GET /v1/leads/admin/sales` | SUPER_ADMIN / SALES_ADMIN sales pool | **Yes** |
| 6 | `GET /v1/leads/admin/sales/counts` | Sales admin heatmap + Total pill | **Yes** (same rules as list) |
| 7 | `GET /v1/leads/admin/presales` | Admin presales pool | **Yes** |
| 8 | `GET /v1/leads/admin/presales/counts` | Presales admin counts | **Yes** (same rules as list) |

**Counts endpoints (#6, #8) must apply identical filter logic as their list twins.**  
If list returns 42 rows for a filter, `/counts` must return `totalElements: 42` for the same query string.

### Also recommended (same contract)

| # | Hub endpoint | Notes |
|---|--------------|-------|
| 9 | `GET /v1/WalkinLead` (list) | Walk-in is merged in frontend; date filter should work when walk-in is in filter flow |
| 10 | `GET /v1/leads/filter?leadType=walkinlead` | If walk-in is served via filter like other types |

### Optional (Phase 2 — not required for first release)

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/leads/schedule-summary?dateFrom&dateTo&dateField&…` | Single aggregated response: `{ followUpCount, meetingCount, byMilestone: {…} }` for dashboard cards without loading full list |

**Phase 1 is enough** for the CRM table, pagination, and Total Leads pill.

---

## 3. New query parameter

### `dateField` (new)

Selects **which timestamp** `dateFrom` / `dateTo` apply to.

| Value | Meaning | DB / entity field (canonical) |
|-------|---------|----------------------------------|
| `created` | Lead creation ( **default** — backward compatible ) | `created_at` / `createdAt` |
| `followUp` | Next scheduled follow-up call | `follow_up_date` / `followUpDate` |
| `meeting` | Scheduled meeting / site visit | `meeting_date` / `meetingDate` |
| `assigned` | When lead was assigned to current assignee (presales month windows) | `assigned_at` / `assignedOn` (see §6) |

**Default when omitted:** `created` (current production behavior unchanged).

**Invalid value:** `400` with JSON `{ "error": "Invalid dateField", "allowed": ["created","followUp","meeting","assigned"] }`

### Existing params (unchanged names)

| Param | Format | Example |
|-------|--------|---------|
| `dateFrom` | ISO local date `YYYY-MM-DD` | `2026-06-16` |
| `dateTo` | ISO local date `YYYY-MM-DD` | `2026-06-22` |
| `sort` | Spring sort | `updatedAt,desc`, `createdAt,asc`, `followUpDate,asc` |
| `milestoneScope` | CRM scope | `crm` |
| `milestoneStage` | Sales top stage | `Connection` |
| `milestoneStageCategory` | Sales category | … |
| `milestoneSubStage` | Sales substage | `Meeting Scheduled` |
| `presalesMilestoneStage` | Presales stage | `Data Discovery` |
| `presalesMilestoneCategory` | Presales category | … |
| `presalesMilestoneSubStage` | Presales substage | … |
| `verificationStatus` | `verified` / `unverified` | … |
| `assignee` | Display name substring | … |
| `leadType` | `formlead`, `glead`, … | … |
| `search` | Free text | … |

Frontend will send **`dateField` together with `dateFrom` / `dateTo`** on all paths above.

---

## 4. Date range semantics (must match across all 8 endpoints)

Apply **inclusive calendar-day range** in **server timezone** (same TZ you use for `created` filter today).

```
dateFrom = 2026-06-16  →  window start = 2026-06-16T00:00:00 (server local)
dateTo   = 2026-06-22  →  window end   = 2026-06-22T23:59:59.999 (server local)
```

Rules:

1. **Both empty** → no date filter (all dates allowed).
2. **Only `dateFrom`** → `field >= startOfDay(dateFrom)`.
3. **Only `dateTo`** → `field <= endOfDay(dateTo)`.
4. **Both set** → `startOfDay(dateFrom) <= field <= endOfDay(dateTo)`.
5. **`dateField=followUp` or `meeting`** → rows with **null / empty** date are **excluded** when any date bound is set.
6. **`dateField=created`** → keep today’s behavior (including any fallback to `updated_at` you already implement).
7. Parse **`followUpDate`** strings that use a space before time (`2026-06-20 14:30:00`) — normalize to ISO before compare (frontend already does this).

---

## 5. Field resolution per `dateField`

### `dateField=created` (default)

Use the same logic Hub uses today for `dateFrom`/`dateTo`.

Frontend BFF currently resolves creation from (for reference only):

- `createdAt`, `createdDate`, `leadDate`, `createdOn`, `created_at`, dynamic field aliases

**Backend should own this in SQL**, not rely on frontend re-filter.

### `dateField=followUp`

Filter on **`followUpDate`** (nullable).

Aliases to accept if stored differently:

- `follow_up_date`, `nextFollowUp`, `next_call_date`

**Include in list DTO** so table can show the date without opening detail:

```json
{
  "id": 12345,
  "followUpDate": "2026-06-20T14:30:00",
  "meetingDate": null,
  "milestoneStage": "Connection"
}
```

### `dateField=meeting`

Filter on **`meetingDate`** (nullable).

Aliases:

- `meeting_date`, `siteVisitDate`, `site_visit_date`

**Important:** When user schedules via Complete Task + appointment, frontend saves `meetingDate` on the lead. Filter must use **persisted lead column**, not only the appointments table. (Optional enhancement: also consider latest active appointment `startTime` if lead column empty — document if you add this.)

### `dateField=assigned` (presales)

Used when frontend sends `crmMonthWindow=current` (presales “this month” cards). Today BFF approximates with assignment timestamp.

Filter on first non-null of:

- `assignedAt`, `assignedOn`, `assigned_at`, presales handoff timestamp

If assignment date missing, **fallback to `createdAt`** (document this in Hub — frontend BFF does the same).

---

## 6. Presales vs sales rules

| Workspace | Default `dateField` in UI | Notes |
|-----------|---------------------------|-------|
| **Sales** | `created` | Manager planning views will switch to `followUp` / `meeting` |
| **Presales** | `assigned` when `crmMonthWindow=current`; else user-selected | Presales month summary stays on assignment; custom range can use `followUp` |

**Milestone param names (unchanged):**

- Sales list: `milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`
- Presales list: `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage`

**Combined example (manager use case):**

```http
GET /v1/leads/filter
  ?leadType=formlead
  &milestoneScope=crm
  &verificationStatus=verified
  &milestoneStage=Connection
  &dateField=followUp
  &dateFrom=2026-06-16
  &dateTo=2026-06-22
  &page=0
  &size=20
  &sort=followUpDate,asc
```

Expected: verified CRM leads in **Connection** whose **follow-up** falls in that week, within JWT assignee scope.

---

## 7. JWT scope (unchanged)

Date filtering is **in addition to** existing visibility rules:

| Role | Scope |
|------|-------|
| SALES_EXECUTIVE | Own assigned leads |
| SALES_MANAGER | My / team endpoints or wider pool + assignee filter |
| SALES_ADMIN / SUPER_ADMIN | Admin sales pool |
| PRESALES_* | Presales-search inbox |

Do **not** return leads outside JWT scope even if dates match.

---

## 8. Response contract

### List (`SpringPage`)

Existing shape — no breaking changes:

```json
{
  "content": [ { /* ApiLead */ } ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

**Add (optional but helpful)** echo of applied filter:

```json
{
  "dateField": "followUp",
  "dateFrom": "2026-06-16",
  "dateTo": "2026-06-22",
  "totalElements": 42
}
```

Admin list already has optional `dateField` in frontend types — please populate it consistently.

### Counts (`/admin/sales/counts`, `/admin/presales/counts`)

Must honor **`dateField` + `dateFrom` + `dateTo` + milestone + verification + assignee** exactly like list.

```json
{
  "success": true,
  "totalElements": 42,
  "verifiedCount": 40,
  "byLeadType": { "formlead": 10, "glead": 8, "…": "…" },
  "countsBySalesMilestone": { "Connection": 12, "Discovery": 8 }
}
```

If milestone breakdown is expensive, still return correct **`totalElements`** for the filter; milestone map can be best-effort but must not contradict list total when same params are used.

---

## 9. Sorting

Support sort fields aligned with `dateField`:

| `sort` value | When used |
|--------------|-----------|
| `followUpDate,asc` / `followUpDate,desc` | Follow-up planning view |
| `meetingDate,asc` / `meetingDate,desc` | Meeting planning view |
| `createdAt,asc` / `createdAt,desc` | Creation date view |
| `updatedAt,desc` | Default today |

Leads with **null** sort field sort **last** in ASC, **first** in DESC (or pick one rule and document — frontend will mirror).

---

## 10. Database recommendations

Add / confirm indexes for filter + sort at scale:

```sql
-- Example names — adjust to your schema
CREATE INDEX idx_leads_follow_up_date ON leads (follow_up_date);
CREATE INDEX idx_leads_meeting_date ON leads (meeting_date);
CREATE INDEX idx_leads_created_at ON leads (created_at);
CREATE INDEX idx_leads_assigned_at ON leads (assigned_at);

-- Composite if you often filter milestone + date together
CREATE INDEX idx_leads_crm_connection_followup
  ON leads (milestone_stage, follow_up_date)
  WHERE milestone_scope = 'crm';
```

Without indexes, “next week meetings across admin pool” will not scale.

---

## 11. Example requests (copy-paste for QA)

### A. Next week meetings (all stages)

```http
GET /v1/leads/filter?leadType=formlead&milestoneScope=crm&verificationStatus=verified&dateField=meeting&dateFrom=2026-06-16&dateTo=2026-06-22&page=0&size=20&sort=meetingDate,asc
Authorization: Bearer <sales_manager_token>
```

### B. Single-day follow-ups

```http
GET /v1/leads/filter?leadType=formlead&milestoneScope=crm&verificationStatus=verified&dateField=followUp&dateFrom=2026-06-15&dateTo=2026-06-15&page=0&size=50
Authorization: Bearer <sales_executive_token>
```

### C. Connection stage + follow-up next week

```http
GET /v1/leads/filter?leadType=formlead&milestoneScope=crm&verificationStatus=verified&milestoneStage=Connection&dateField=followUp&dateFrom=2026-06-16&dateTo=2026-06-22&page=0&size=20
Authorization: Bearer <sales_manager_token>
```

### D. Admin pool counts must match list

```http
GET /v1/leads/admin/sales/counts?milestoneScope=crm&milestoneStage=Connection&dateField=meeting&dateFrom=2026-06-16&dateTo=2026-06-22
Authorization: Bearer <sales_admin_token>
```

```http
GET /v1/leads/admin/sales?milestoneScope=crm&milestoneStage=Connection&dateField=meeting&dateFrom=2026-06-16&dateTo=2026-06-22&page=0&size=20
Authorization: Bearer <sales_admin_token>
```

→ `counts.totalElements` **must equal** list `totalElements` (not just current page length).

### E. Presales inbox — follow-ups this week

```http
GET /v1/leads/presales-search?milestoneScope=crm&verificationStatus=unverified&dateField=followUp&dateFrom=2026-06-16&dateTo=2026-06-22&page=0&size=20
Authorization: Bearer <presales_executive_token>
```

### F. Backward compatibility — no `dateField`

```http
GET /v1/leads/filter?dateFrom=2026-06-01&dateTo=2026-06-30&leadType=formlead&milestoneScope=crm
```

→ Must behave **exactly as today** (creation date filter).

---

## 12. Edge cases to handle

| Case | Expected behavior |
|------|-------------------|
| Lead created in January, follow-up in June | Included when `dateField=followUp` and June range selected |
| `followUpDate` set but `meetingDate` empty | `dateField=meeting` excludes row |
| `meetingDate` copied from follow-up in UI | Both fields may match — filter each independently |
| LOST leads with past follow-up | Included if date in range unless milestone/substage filters exclude |
| Reinquiry rows | Same date rules; respect `reinquiry` param if sent |
| Timezone | Use Hub server TZ consistently; document in release notes |
| Walk-in leads | Apply `followUpDate` / `created` same as other types when walk-in is in filter API |

---

## 13. What frontend will do after Hub ships

No new Hub URLs from frontend — only new query param on existing proxy calls.

| Layer | Change |
|-------|--------|
| **Toolbar** | Dropdown: “Filter dates by: Created / Follow-up / Meeting” |
| **Header / LeadsDataSection** | Pass `dateField` on every list + counts fetch |
| **BFF** (`app/api/crm/leads/route.ts`) | Forward `dateField` to Hub; remove duplicate in-memory date filter for fields Hub handles |
| **Admin** (`lib/admin-leads-api.ts`) | Append `dateField` in `appendAdminLeadsFilters()` |

Proxy example (frontend → BFF):

```http
GET /api/crm/leads?mergeAll=1&milestoneScope=crm&dateField=followUp&dateFrom=2026-06-16&dateTo=2026-06-22&milestoneStage=Connection&…
```

BFF forwards to Hub:

```http
GET /v1/leads/filter?…&dateField=followUp&dateFrom=2026-06-16&dateTo=2026-06-22&…
```

---

## 14. Acceptance criteria (definition of done)

- [ ] All **8** endpoints accept `dateField` with default `created`
- [ ] `dateField=followUp` filters on `followUpDate` with inclusive day range
- [ ] `dateField=meeting` filters on `meetingDate` with inclusive day range
- [ ] Null follow-up/meeting excluded when date bounds present
- [ ] Works with `milestoneStage=Connection` (and presales milestone params)
- [ ] JWT scope unchanged
- [ ] `/counts` totals match `/list` totals for identical query strings
- [ ] List DTO includes `followUpDate` and `meetingDate` on each row
- [ ] Sort by `followUpDate` / `meetingDate` works
- [ ] Omitting `dateField` → zero regression vs current production
- [ ] Postman collection or Swagger updated

---

## 15. Suggested QA matrix

| dateField | dateFrom | dateTo | milestone | Expect |
|-----------|----------|--------|-----------|--------|
| (omit) | 2026-06-01 | 2026-06-30 | — | Same as prod (created) |
| followUp | 2026-06-16 | 2026-06-22 | — | Only leads with follow-up in range |
| meeting | 2026-06-16 | 2026-06-22 | — | Only leads with meeting in range |
| followUp | 2026-06-16 | 2026-06-22 | Connection | Subset: Connection + follow-up in range |
| meeting | 2026-06-16 | 2026-06-22 | Connection | Subset: Connection + meeting in range |
| followUp | 2026-06-15 | 2026-06-15 | — | Single-day follow-ups |
| followUp | — | — | — | All leads (no date filter) |

For each row: compare **`totalElements`**, spot-check 3 lead IDs, confirm **`followUpDate` / `meetingDate`** on row matches filter.

---

## 16. Out of scope (Phase 1)

- Separate REST resources `/follow-ups` or `/meetings`
- Calendar ICS export
- Filtering on **appointment table only** without lead `meetingDate` column
- Insight tiles (“Today’s follow-up”) — those stay client-side for “today”; toolbar range uses Hub filter
- Combined OR filter (`followUp OR meeting` in one query) — Phase 2; Phase 1 user picks one `dateField` at a time

**Phase 2 optional:** `dateField=anySchedule` → match if **either** follow-up **or** meeting in range (manager “everything scheduled next week” view).

---

## 17. Related frontend docs

| Doc | Topic |
|-----|-------|
| `docs/CRM_FILTERS_AND_COUNT_MISMATCH.md` | Why counts must match filters |
| `docs/CRM_FULL_SYSTEM_FLOW.md` | BFF merge + filter flow |
| `docs/ADMIN_LEADS_FRONTEND_INTEGRATION.md` | Admin pool integration |
| `lib/lead-follow-up-insights.ts` | Client-side follow-up parsing (reference for date parsing) |
| `lib/follow-up-date.ts` | `followUpDate` string normalization |

---

## 18. One-line ask for backend team

> Add **`dateField=created|followUp|meeting|assigned`** to existing **`/v1/leads/*` list and counts APIs**, filter in SQL with inclusive **`dateFrom`/`dateTo`**, return **`followUpDate`/`meetingDate` on list rows**, and keep **`dateField` omitted = today’s created-date behavior**.

---

*Document version: 2026-06-13 — CRM Inceneration frontend → Hub backend handoff.*

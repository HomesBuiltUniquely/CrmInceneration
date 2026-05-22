# CrmInceneration — Project Guide

Complete reference for how this CRM frontend works: architecture, roles, presales vs sales pipelines, lead lifecycle, APIs, and key files.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4  
**Backend:** Hub API (`BASE_URL`, default `https://hows.hubinterior.com`) via Next.js BFF proxies under `app/api/`

---

## Table of contents

1. [What this project is](#1-what-this-project-is)
2. [Repository layout](#2-repository-layout)
3. [Authentication and landing pages](#3-authentication-and-landing-pages)
4. [Roles — who does what](#4-roles--who-does-what)
5. [Lead sources (types)](#5-lead-sources-types)
6. [Two pipelines: Presales vs Sales](#6-two-pipelines-presales-vs-sales)
7. [End-to-end lead lifecycle](#7-end-to-end-lead-lifecycle)
8. [Presales workflow (detail)](#8-presales-workflow-detail)
9. [Sales workflow (detail)](#9-sales-workflow-detail)
10. [Complete Task modal](#10-complete-task-modal)
11. [Pages and routes](#11-pages-and-routes)
12. [API and data layer](#12-api-and-data-layer)
13. [Business rules (gates and guards)](#13-business-rules-gates-and-guards)
14. [Key files index](#14-key-files-index)
15. [Related documentation](#15-related-documentation)

---

## 1. What this project is

**CrmInceneration** (`my-app/`) is the **New CRM** UI for Hub Interior. It manages interior-design leads from intake through presales qualification, handoff to sales, milestone progression, appointments, design QA, quotes, and sales closure.

Core idea: **one lead record, two milestone tracks**

| Track | When | Fields |
|-------|------|--------|
| **Presales** | Lead is unverified / in presales pool | `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage` |
| **Sales** | After verify (handoff) | `stage.milestoneStage`, `milestoneStageCategory`, `milestoneSubStage` |

Presales qualifies and **verifies** the lead. Sales owns the pipeline from **Fresh Lead** to **Closed**.

---

## 2. Repository layout

```
CrmInceneration/
├── my-app/                    ← main Next.js app
│   ├── app/                   pages + API routes + Components
│   ├── lib/                   business logic, API clients
│   ├── types/                 shared TypeScript (e.g. crm-pipeline)
│   └── docs/                  handoff & role guides (this file)
├── package.json               workspace (nodemailer at root)
└── README.md                  generic Next.js stub — use my-app/docs for CRM
```

### `my-app/app/` — pages

| Path | Purpose |
|------|---------|
| `/` | Sales dashboard — analytics + `CrmPipeline` |
| `/login` | Auth → role-based redirect |
| `/Leads` | Lead inbox (list, filters, heatmap) |
| `/Leads/{leadType}/{id}` | Lead detail (production API client) |
| `/create-lead`, `/import-leads` | Manual create / Excel import |
| `/google-calendar`, `/appointment` | Calendar & designer slots |
| `/design-dashboard` | Designer queue |
| `/admin`, `/super-admin`, `/sales-manager` | Role dashboards |
| `/admin-panel` | User/team admin |

### `my-app/app/api/` — BFF proxies

Browser calls **same-origin** `/api/crm/*` routes. Server forwards `Authorization: Bearer <crm_token>` to Hub.

### `my-app/lib/` — business logic

| Module | Responsibility |
|--------|----------------|
| `presales-milestone.ts` | Presales stage order, filters, handoff detection |
| `complete-task-pipeline.ts` | Sales/presales Complete Task stage mapping |
| `milestone-advance-gates.ts` | Budget/property/config gate before Connection |
| `milestone-substage-map.ts` | LOST reason, meeting substages, closure rules |
| `roleUtils.ts`, `crm-role-access.ts` | Role checks, lead-type filters |
| `leads-filter.ts` | List mapping, verification, `milestoneScope` |
| `crm-pipeline.ts` | Fetch pipeline tree from Hub |
| `lead-details-client.ts` | PUT/verify/activity + payload normalization |
| `crm-lead-endpoints.ts` | Lead type → Hub REST paths |
| `auth/api.ts` | Login, role normalization, landing routes |
| `sales-closure.ts` | External Sales Closure URL + role gates |

---

## 3. Authentication and landing pages

### Flow

```
POST /api/auth/login  →  token + user
GET  /api/auth/me     →  confirm role / designer name
localStorage: crm_token, crm_role, crm_user_name
```

Protected pages use `RequireAuth` — no token → redirect `/login`.

### Role normalization (`lib/auth/api.ts`)

| Raw from API | Normalized |
|--------------|------------|
| `PRE_SALES` | `PRESALES_EXECUTIVE` |
| `PRE_SALES_MANAGER` | `PRESALES_MANAGER` |

### Landing after login (`landingPathByRole`)

| Role | First page |
|------|------------|
| `SUPER_ADMIN` | `/super-admin` |
| `ADMIN`, `SALES_ADMIN` | `/admin` |
| `SALES_MANAGER` | `/sales-manager` |
| `DESIGNER`, `DESIGN_MANAGER`, `TERRITORY_DESIGN_MANAGER` | `/design-dashboard` |
| `PRESALES_*`, `SALES_EXECUTIVE`, others | `/Leads` |

Sales/presales executives also use `/` (dashboard) from sidebar when allowed.

---

## 4. Roles — who does what

### CRM roles overview

| Role | Primary workspace | Main responsibilities |
|------|-------------------|------------------------|
| **SUPER_ADMIN** | `/super-admin` | Full access; load all users; designer dashboard; calendar |
| **ADMIN** | `/admin` | Admin dashboard; **dual milestone view** on unverified presales leads |
| **SALES_ADMIN** | `/admin` | Like ADMIN; **cannot** do Booking Done / some Closed closure actions |
| **SALES_MANAGER** | `/sales-manager` | Team leads; narrowed list by manager + team executives |
| **SALES_EXECUTIVE** | `/Leads` | Own sales pipeline; Complete Task; Sales Closure on WON |
| **PRESALES_MANAGER** | `/Leads` | All lead types; presales search; team context; verify per assignee rules |
| **PRESALES_EXECUTIVE** | `/Leads` | Assigned presales leads; **Verify Lead** (core); presales Complete Task |
| **DESIGNER** / **DESIGN_MANAGER** / **TERRITORY_DESIGN_MANAGER** | `/design-dashboard` | Design queue, appointments — not CRM pipeline owners |

Legacy alias **`PRE_SALES`** → treated as **`PRESALES_EXECUTIVE`** everywhere in UI.

### Capability matrix

| Capability | PRESALES_EXEC | PRESALES_MGR | SALES_EXEC | SALES_MGR | SALES_ADMIN | ADMIN | SUPER_ADMIN |
|------------|:-------------:|:------------:|:----------:|:---------:|:-----------:|:-----:|:-----------:|
| Presales Complete Task | ✓ | ✓ | — | — | — | ✓* | ✓* |
| Verify Lead (handoff) | ✓ | ✓† | — | — | — | — | — |
| Sales Complete Task | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| View both pipelines on detail | — | — | — | — | ✓ | ✓ | ✓ |
| Sales Closure (Won) | — | — | ✓ | ✓ | limited | limited | ✓ |
| Admin panel / delete-all | — | — | — | — | — | ✓ | ✓ |
| Designer dashboard | — | — | — | — | — | — | ✓ |

\* Admin on **unverified** presales lead sees presales pipeline in Complete Task.  
† Manager verify when backend assignee rules allow.

### Pipeline API role param

`GET /api/crm/crm-pipeline?role=` uses:

- Presales roles → `PRESALES_EXECUTIVE`
- Sales roles → `SALES_EXECUTIVE`

### List visibility highlights

- **Presales executive:** assigned leads + verified pool rules (`presales-lead-visibility.ts`)
- **Presales manager:** all 5 lead types with `milestoneScope=crm`; presales cross-source search
- **Sales executive:** own assigned verified leads; filter option **Verified Leads**
- **Sales manager:** `GET /api/crm/sales-manager/my-leads` and `team-leads`

---

## 5. Lead sources (types)

Five lead types merge in the inbox (`mergeAll=1`):

| `leadType` | Hub REST base | UI label |
|------------|---------------|----------|
| `formlead` | `/v1/FormLead` | External Lead |
| `glead` | `/v1/Home1` | Google Ads |
| `mlead` | `/v1/MetaLead` | Meta Ads |
| `addlead` | `/v1/AddLead` | Add Lead |
| `websitelead` | `/v1/WebsiteLead` | Website Lead |

Detail URL pattern: `/Leads/{leadType}/{id}`

Verify endpoint: `POST /v1/{Base}/verify/{id}` (proxied as `/api/crm/lead/{leadType}/{id}/verify`)

---

## 6. Two pipelines: Presales vs Sales

### Presales pipeline (3 top-level stages)

```
Fresh Data  →  Data Discovery  →  Data Conversion
```

- Milestone fields: `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage`
- List filters use `presalesMilestone*` query params
- **Forward-only** within these three stages (can stay or advance, not go backward in UI)
- Substage names (Won/Lost branches, feedback options) come from Hub:  
  `GET /api/crm/crm-pipeline?role=PRESALES_EXECUTIVE&nested=true&forCompleteTask=true&currentStage=...`

### Sales pipeline (6 top-level stages)

```
Fresh Lead  →  Discovery  →  Connection  →  Experience & Design  →  Decision  →  Closed
```

- Milestone fields: `stage.milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`
- List filters use `milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`
- **Fresh Lead** Complete Task may jump to **Discovery** or **Connection** (Hub bundles substages)
- Other stages: generally **next stage only**
- Substage catalog from Hub:  
  `GET /api/crm/crm-pipeline?role=SALES_EXECUTIVE&nested=true&forCompleteTask=true&currentStage=...`

### Handoff boundary

| State | Presales UI | Sales UI |
|-------|-------------|----------|
| `verified = false` | Full presales work | N/A (lead not in sales pool yet) |
| **Verify Lead** clicked | Sets verified, assigns sales exec, presales → `Data Conversion / Won / Assigned` | Lead enters sales pipeline |
| `verified = true` | **Read-only** for presales roles (`isPresalesHandedOffReadOnly`) | Primary owners |

**Critical rule:** `Data Conversion / Won / Assigned` is **not** set via presales Complete Task PUT on unverified leads. Use **Verify Lead** only.

---

## 7. End-to-end lead lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INTAKE                                                                   │
│  Form / Google Ads / Meta / Website / Manual create / Excel import       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PRESALES (unverified)                                                    │
│  Assign to PRESALES_EXECUTIVE                                            │
│  Complete Task: Fresh Data → Data Discovery → Data Conversion            │
│  Filters: verificationStatus=unverified, presalesMilestone*              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          [ Verify Lead ]
                          pincode + optional salesExecutiveId
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SALES (verified)                                                         │
│  milestoneStage: Fresh Lead → … → Closed                                 │
│  Appointments, Design QA, quotes, emails per substage                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              [ LOST path ]                    [ WON path ]
              resone required                  Token Done / Booking Done
                                                    │
                                                    ▼
                                         Sales Closure (external)
                                         design.hubinterior.com
```

### Reinquiry

Leads with non-empty `additionalLeadSources` are reinquiries. Filter: `reinquiry=true|false`.

### Stage rollback

`POST /api/crm/lead/{leadType}/{id}/stage-rollback` — milestone rollback when Hub allows.

---

## 8. Presales workflow (detail)

### Stage progression

| From | Allowed forward targets |
|------|-------------------------|
| Fresh Data | Fresh Data, Data Discovery, Data Conversion |
| Data Discovery | Data Discovery, Data Conversion |
| Data Conversion | Data Conversion only |

### Main actions

| Action | How | API |
|--------|-----|-----|
| Advance substage | **Complete Task** modal | `PUT /api/crm/lead/{type}/{id}` with presales milestone fields |
| Handoff to sales | **Verify Lead** (footer or verify panel in modal) | `POST .../verify` with `{ pincode, salesExecutiveId?, note }` |
| Log call / note | Activity timeline | `POST .../activity` |

### Verify Lead rules (frontend + docs)

- Role: `PRESALES_EXECUTIVE` (assigned lead)
- **Pincode required**
- Optional manual pick of sales executive; else auto-assign
- On success: `verified=true`, presales milestone → **Data Conversion / Won / Assigned**

### UI guards

- Unverified: Complete Task feedback list **hides** Data Conversion + Won category
- Attempting Won/Assigned via PUT shows:  
  *"Use Verify Lead to move to sales. Data Conversion / Won / Assigned is set after verification, not from Complete Task."*
- After handoff: presales Complete Task **blocked** (read-only message)

### Presales manager extras

- Cross-source search: `GET /api/crm/presales-search`
- Team verified tab (where enabled in toolbar)
- All 5 lead types in filter (frontend merges; Hub may historically restrict manager on raw filter)

---

## 9. Sales workflow (detail)

### Stage progression

| Stage | Notes |
|-------|-------|
| **Fresh Lead** | Intake; Complete Task can target Discovery **or** Connection |
| **Discovery** | Qualification substages |
| **Connection** | **Gate:** budget, property notes, configuration required if coming from Fresh/Discovery |
| **Experience & Design** | Meeting substages → schedule/cancel/reschedule appointments |
| **Decision** | Late-stage substages |
| **Closed** | Won/Lost branches; Token Done, Booking Done |

### Milestone model (3 levels)

1. **Stage** — e.g. `Connection`
2. **Category** — often **Won** / **Lost** path
3. **Substage** — feedback label, e.g. `Meeting Scheduled`, `Booking Done`

Dashboard home (`/`) shows sales pipeline chevrons + Won/Lost path cards per selected stage.

### Close paths

| Path | Requirements |
|------|----------------|
| **Lost** | `resone` (reason) required |
| **Won → Token Done** | Standard Complete Task save |
| **Won → Booking Done** | Restricted roles; opens **Sales Closure** external flow |
| Closure cancel/refund substages | `resone` required |

### Sales Closure

External app: `NEXT_PUBLIC_SALES_CLOSURE_ORIGIN` (default `https://design.hubinterior.com`)

Opened when milestone hits WON + eligible substage. Prefill from lead + auth user email.  
`SALES_EXECUTIVE` may auto-open on WON save (`maybeOpenSalesClosureOnWon`).

### Supporting features on sales leads

- **Appointments** — meeting substages open designer slot picker
- **Design QA** — `DesignQaPanel` + `/api/crm/design-qa/...`
- **Quotes / email** — quote send routes, substage email mapping
- **Google Calendar** — Hub calendar integration

---

## 10. Complete Task modal

**File:** `app/Components/CrmLeadDetails/CompleteTaskModal.tsx` (~1500 lines)  
**Orchestrator:** `LeadDetailsApiClient.tsx`

### Mode selection

```
Open Complete Task
  │
  ├─ presalesMode?
  │    (presales role AND lead not handed off)
  │    OR admin viewing unverified presales lead
  │
  │    ├─ handed off? → block / switch to sales view
  │    ├─ load PRESALES_EXECUTIVE pipeline
  │    ├─ pick stage → category → substage (feedback)
  │    ├─ save → PUT presalesMilestone* + followUpDate + resone if LOST
  │    └─ "Assigned" path → Verify panel → POST verify (NOT PUT)
  │
  └─ salesMode
       ├─ load SALES_EXECUTIVE pipeline (forCompleteTask + currentStage)
       ├─ property gate / meeting schedule / resone validation
       └─ save → PUT sales milestones + optional appointment side effects
```

### Save payload (sales)

- `milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`
- `followUpDate` / `nextCallDate`
- `resone` on LOST or certain closure substages
- `meetingAppointment` for scheduling substages
- Inline budget / property notes / configuration when gate applies

### Save payload (presales)

- `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage`
- `feedback`, `note`, `followUpDate`
- `normalizeLeadUpdatePayload` syncs root + `stage.presalesMilestone*`

---

## 11. Pages and routes

### Lead detail composition

| Component | Function |
|-----------|----------|
| `LeadDetailsApiClient.tsx` | Fetch, save, verify, Complete Task, Design QA, quotes, closure |
| `LeadHeader.tsx` | Status badge, presales vs sales, Closed / Sales Closure CTAs |
| `Tabs.tsx` | Lead Information / Assignments / Activity History |
| `LeadInfoTab.tsx` | Profile, Design QA link |
| `AssignmentsTab.tsx` | Assignment UI |
| `ActivityTimeline.tsx` | Activities + notes |
| `CompleteTaskModal.tsx` | Milestone task completion (dual mode) |
| `PresalesVerifyPanel.tsx` | Pincode + sales executive picker |
| `FooterActions.tsx` | Save, Print, Verify, Close |

### List / dashboard components

| Component | Function |
|-----------|----------|
| `LeadsDataSection.tsx` | Merged list fetch, role scoping, milestone tiles |
| `LeadsToolbar.tsx` | Filters, presales manager tabs |
| `LeadsTable.tsx` | Rows + journey progress % |
| `JourneyPhaseHeatmap.tsx` | Phase analytics |
| `CrmPipeline.tsx` | Home dashboard pipeline widgets |

---

## 12. API and data layer

### Request flow

```
Browser  →  /api/crm/* (Next.js BFF)
         →  Hub BASE_URL /v1/...
         Authorization: Bearer <crm_token>
```

### Essential list query params

Always use for New CRM inbox:

- `milestoneScope=crm`
- `mergeAll=1` (merge all 5 lead types)

Role-specific milestone filters:

- Presales: `presalesMilestoneStage`, `presalesMilestoneCategory`, `presalesMilestoneSubStage`
- Sales: `milestoneStage`, `milestoneStageCategory`, `milestoneSubStage`

Other filters: `verificationStatus`, `reinquiry`, `assignee`, date range, `leadType`, `search`

### Core proxy routes

| Proxy | Purpose |
|-------|---------|
| `GET /api/crm/leads` | Merged lead inbox |
| `GET /api/crm/crm-pipeline` | Milestone tree for filters + Complete Task |
| `GET/PUT /api/crm/lead/[leadType]/[id]` | Detail read/save |
| `POST .../verify` | Presales handoff |
| `GET/POST .../activities`, `.../activity` | Timeline |
| `POST .../stage-rollback` | Milestone rollback |
| `GET /api/crm/presales-search` | Cross-source presales search |
| `GET /api/crm/dashboard-metrics` | Dashboard counts |
| `GET /api/crm/sales-manager/my-leads`, `team-leads` | Manager scope |

### Error parsing (required pattern)

```typescript
const msg =
  data?.userMessage ??
  data?.error ??
  data?.message ??
  "Unable to save lead details. Please try again.";
```

### Data models

| Type | File | Use |
|------|------|-----|
| `ApiLead` | `leads-filter.ts` | Wire format from Hub |
| `Lead` | `data.ts` | UI model + mocks |
| `LeadRowModel` | list components | Row + journey % |
| `CrmPipelineResponse` | `types/crm-pipeline.ts` | `entries[]` + `nested[]` stage tree |

---

## 13. Business rules (gates and guards)

| Rule | Where |
|------|-------|
| Fresh/Discovery → **Connection** needs budget, property notes, configuration (non-empty, not NA/none) | `milestone-advance-gates.ts` |
| LOST category → **resone** required | `milestone-substage-map.ts` |
| Token/booking cancel, refund substages → **resone** | `milestone-substage-map.ts` |
| Meeting Cancelled/Paused normalized to `Meeting Cancelled` for API/email | `milestone-substage-map.ts` |
| Meeting substages → designer appointment picker | `isMeetingScheduleSubstage` |
| Unverified presales → hide Data Conversion / Won / Assigned in Complete Task | `CompleteTaskModal`, `presales-milestone-ui.ts` |
| Presales handed off → read-only Complete Task for presales roles | `presales-milestone.ts` |
| Booking Done / Closed Won closure | `sales-closure.ts` — role-restricted |
| List always `milestoneScope=crm` | `LeadsDataSection`, proxy |

**Source of truth for exact substage names:** Hub `crm-pipeline` JSON — not fully hardcoded in frontend (except gate/email helpers).

---

## 14. Key files index

| Topic | Path |
|-------|------|
| Presales milestones | `lib/presales-milestone.ts` |
| Sales Complete Task mapping | `lib/complete-task-pipeline.ts` |
| Roles | `lib/roleUtils.ts`, `lib/crm-role-access.ts`, `lib/auth/api.ts` |
| Complete Task UI | `app/Components/CrmLeadDetails/CompleteTaskModal.tsx` |
| Lead detail orchestration | `app/Components/CrmLeadDetails/LeadDetailsApiClient.tsx` |
| Verify panel | `app/Components/CrmLeadDetails/PresalesVerifyPanel.tsx` |
| Lead inbox | `app/Components/CrmLeadData/LeadsDataSection.tsx` |
| Merged leads proxy | `app/api/crm/leads/route.ts` |
| Pipeline proxy | `app/api/crm/crm-pipeline/route.ts` |
| Hub path map | `lib/crm-lead-endpoints.ts` |
| Pipeline types | `types/crm-pipeline.ts` |

---

## 15. Related documentation

| Document | Topic |
|----------|-------|
| `PRESALES_ROLES_MASTER_GUIDE.md` | Presales roles, APIs, verify flow |
| `NEW_CRM_SALES_PRESALES_BACKEND_HANDOFF.md` | Backend behavior checklist |
| `PRESALES_CRM_PIPELINE_BACKEND_HANDOFF.md` | Presales pipeline API contract |
| `sales-closure-prefill.md` | Sales Closure URL params |
| `first-call-tracking-backend-guide.md` | First call tracking |
| `NEW_CRM_PRESALES_TRACKING_AND_READONLY.md` | Post-verify read-only (stub — see code) |

---

## Quick reference diagrams

### Role → workspace

```
Login
  ├─ SUPER_ADMIN / ADMIN / SALES_ADMIN  →  /super-admin or /admin
  ├─ SALES_MANAGER                      →  /sales-manager
  ├─ DESIGN*                            →  /design-dashboard
  └─ PRESALES_* / SALES_EXECUTIVE       →  /Leads
```

### Presales → Sales handoff

```
Fresh Data → Data Discovery → Data Conversion
                                      │
                               [ Verify Lead ]
                                      │
                               verified = true
                               sales exec assigned
                                      │
                               Fresh Lead → … → Closed
```

---

*Generated from frontend codebase. Hub backend is authoritative for substage catalogs and server-side authorization. Update this file when pipeline or role behavior changes.*

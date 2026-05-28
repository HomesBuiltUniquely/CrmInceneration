# Sales & Presales Admin — Frontend Integration

See backend handoff for full API reference. This file tracks **what this repo implements**.

## Admin pools (fetch)

| Screen | APIs |
|--------|------|
| Sales admin | `/api/crm/admin/sales` + `/counts` |
| Presales admin | `/api/crm/admin/presales` + `/counts` |

- `milestoneScope=crm` by default
- No default `verificationStatus=verified`
- `totalElements` from `/counts` matches table filters
- Code: `my-app/lib/admin-leads-api.ts`

## Counts (hybrid)

| UI | Source |
|----|--------|
| **Total Leads** pill | Hub row count (`totalElements`) |
| **Lead Types** box | **Primary** per source for all roles; **SUPER_ADMIN** also sees **All rows** on Total Leads pill (`leadTypeCountsPrimaryUnique` / `leadTypeCountsAllRows`) |
| **Heatmap / No milestone** | Primary-source unique (phone → earliest `created_at` milestone) |
| **Milestone filter table** | Primary rows only (card count = table total) |

## Assignment (`POST /api/assignment/assign`)

Implemented in `my-app/lib/assignment-reassign.ts` + `LeadsDataSection` assign modals.

| Rule | UI |
|------|-----|
| G / M / Website + **verified** + sales → presales | **Reassign reason** required (min 3 chars) |
| Bulk assign | Same `reassignReason` on payload when any selected lead needs it |
| Other moves | Reason hidden |

Payload includes `reassignReason` when required. Backend sets verified/unverified and resets milestones on cross-pool assign.

## Detail pipeline

Use `content[].assigneeRole` from admin list envelope (`flattenAdminListContent`).

## Checklist (frontend)

- [x] Admin sales/presales routes use `/admin/*` only
- [x] No default verified filter on admin sales
- [x] Heatmap + table same pool params
- [x] Sales `milestoneStage` / Presales `presalesMilestoneStage`
- [x] Lead Types: primary + all rows
- [x] No milestone filter (primary rows)
- [x] Reassign reason on G/M/W verified sales → presales

---

*Updated for assign API `reassignReason` + admin pool hybrid counts.*

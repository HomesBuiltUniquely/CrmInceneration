# CRM Date Filter by Field — Frontend Integration Guide

**Status:** Hub backend implemented (Project-ERP)  
**Audience:** Next.js BFF + CRM UI team (`CrmInceneration/my-app`)  
**Backend repo:** `Project-ERP` (Spring Hub)  
**Related:** `docs/DATE_FIELD_FILTER_BACKEND_HANDOFF.md`

---

## 1. Executive summary

The CRM toolbar **From / To** dates can now filter leads by **which timestamp** they refer to — not only creation date.

| User question | Send `dateField` |
|---------------|------------------|
| “Leads created this month” | `created` (default — same as today) |
| “Follow-ups next week” | `followUp` |
| “Meetings next week” | `meeting` |
| “Presales assigned this month” | `assigned` |

**Frontend work:** add `dateField` on every list + counts fetch, toolbar dropdown, remove duplicate BFF date re-filter, align sort with selected field.

**No new Hub URLs** — extend existing proxy calls only.

---

## 2. Architecture

```text
CRM toolbar (dateFrom/dateTo/dateField)
  → Next.js BFF (/api/crm/leads)
  → Hub GET /v1/leads/filter (SQL filter + pagination)
```

**Rule:** Do not re-filter the same date field in BFF memory after Hub responds.

---

## 3. Implementation in this repo

| Layer | File | Status |
|-------|------|--------|
| Helper | `lib/crm-date-field-filter.ts` | `appendCrmDateFilters`, `hubHandlesDateFilter` |
| BFF | `app/api/crm/leads/route.ts` | Forwards `dateField`; skips merge re-filter when Hub handles dates |
| Admin | `lib/admin-leads-api.ts` | `dateField` on filter input + counts |
| Toolbar | `LeadsToolbar.tsx` | “Filter dates by” dropdown |
| State | `Header.tsx` | `dateField` state + session persist |
| Data | `LeadsDataSection.tsx` | Passes `dateField` on all fetches |

---

## 4. Query parameter

See backend guide §3 for full contract. Allowed: `created` | `followUp` | `meeting` | `assigned`.

---

## 5. Hub endpoints (all support `dateField`)

- `GET /v1/leads/filter`
- `GET /v1/leads/sales-manager/my-leads`
- `GET /v1/leads/sales-manager/team-leads`
- `GET /v1/leads/presales-search`
- `GET /v1/leads/admin/sales` + `/counts`
- `GET /v1/leads/admin/presales` + `/counts`
- `GET /v1/Leads/crm-milestone-counts-filtered`

---

## 6. Legacy `meeting_date` (backend only)

RDS migration done — `Appointment.StartTime` → `meeting_date`. No frontend backfill.

### Backend §14 — exact PUT field names (Project-ERP)

| Purpose | JSON field | DB column |
|---------|------------|-----------|
| Follow-up filter | `followUpDate` | `follow_up_date` |
| Meeting filter | `meetingDate` | `meeting_date` |

Minimal PUT example (do **not** merge full GET body for schedule-only sync):

```json
{
  "meetingDate": "2026-06-21T11:00:00",
  "followUpDate": "2026-06-21T11:00:00"
}
```

Complete Task + appointment persist **`meetingDate`** on the lead row (Hub `LeadScheduleDateService`). Filter `dateField=meeting` uses **`meeting_date`** in SQL.

**Legacy rows:** run Hub SQL backfill once on production (`docs/sql/backfill_meeting_date.sql` in Project-ERP). Optional: frontend admin backfill (`/Leads?backfillDates=1`) for gaps only.

### Post-deploy verify (frontend BFF)

```http
POST /api/crm/lead/addlead/11/schedule-dates
Content-Type: application/json

{ "meetingDate": "2026-06-12T15:00:00" }
```

Expect: `"persisted": { "meetingOk": true }`, `"backendFixRequired": false`.

Then CRM toolbar: **Filter dates by → Meeting date**, range including 12 Jun 2026 — lead 11 should appear.

---

## 7. Acceptance checklist

- [x] Toolbar exposes `dateField` (4 options)
- [x] List fetches append `dateField` when dates set (or `assigned` for presales month)
- [x] Admin counts use same params as list
- [x] BFF forwards `dateField` to Hub
- [x] BFF skips in-memory date re-filter when Hub handles dates
- [x] Sort options include `followUpDate` and `meetingDate`
- [ ] Manual QA against Hub (meeting PUT + `dateField=meeting` after deploy + SQL backfill)

---

*Document version: 2026-06-13 — Hub backend → frontend handoff (Project-ERP).*

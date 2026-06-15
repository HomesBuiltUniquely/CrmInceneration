# `meetingDate` PUT → `meeting_date` (resolved)

**Status:** ✅ Fixed in Hub (Project-ERP) — `LeadScheduleDateService` + all 5 lead detail PUTs + appointment hook  
**Date opened:** 2026-06-13  
**Date resolved:** 2026-06-13  
**CRM frontend repo:** `CrmInceneration/my-app`  
**Hub repo:** Project-ERP (Spring)

---

## Summary (after fix)

| Field | JSON on PUT | DB column | PUT persists? | Filter `dateField` works? |
|-------|-------------|-----------|---------------|---------------------------|
| Follow-up | `followUpDate` | `follow_up_date` | **Yes** | **Yes** |
| Meeting | `meetingDate` | `meeting_date` | **Yes** (Hub deploy) | **Yes** when column filled |

Frontend already sends §14 body via `putHubScheduleDates` / Complete Task — **no further frontend code change required.**

---

## Reproduction (copy-paste for Postman)

Replace `{token}`, `{id}`, and base URL.

### 1. GET lead (before)

```http
GET {HUB_BASE}/v1/AddLead/details/11
Authorization: Bearer {token}
```

Note: `followUpDate` may be set; `meetingDate` is null.

### 2. PUT minimal schedule body (frontend §14 contract)

```http
PUT {HUB_BASE}/v1/AddLead/details/11
Authorization: Bearer {token}
Content-Type: application/json

{
  "meetingDate": "2026-06-12T15:00:00"
}
```

### 3. GET lead (after)

```http
GET {HUB_BASE}/v1/AddLead/details/11
Authorization: Bearer {token}
```

**Expected:** `meetingDate` in JSON + `meeting_date` in DB = `2026-06-12 15:00:00`  
**Actual:** `meetingDate` still null; DB `meeting_date` still NULL

### 4. Compare with follow-up (works today)

```http
PUT {HUB_BASE}/v1/AddLead/details/11
Content-Type: application/json
Authorization: Bearer {token}

{
  "followUpDate": "2026-06-12T15:00:00"
}
```

→ `follow_up_date` column **does** update.

---

## Real CRM example (lead id 11)

- Substage: **Meeting Scheduled**
- Activity log: meeting booked 12 Jun 2026 3:00 PM
- UI shows meeting date (fallback from `followUpDate`)
- DB: `follow_up_date` filled, **`meeting_date` NULL**

---

## What frontend already does (no further frontend fix possible)

1. Complete Task save → full lead PUT + second PUT with only `{ meetingDate, followUpDate }`
2. Detail page open → lazy backfill PUT `{ meetingDate }` copied from `followUpDate` when substage is meeting-related
3. Admin one-time backfill → same minimal PUT per lead
4. Field names match backend guide: **`meetingDate`** / **`followUpDate`** only (§14)

Proxy path (same payload reaches Hub):

```http
PUT /api/crm/lead/addlead/11
Body: { "meetingDate": "2026-06-12T15:00:00" }
```

---

## Required backend fix

On **all lead detail PUT handlers** (at minimum):

- `PUT /v1/FormLead/details/{id}`
- `PUT /v1/AddLead/details/{id}`
- `PUT /v1/Home1/details/{id}` (glead)
- `PUT /v1/MetaLead/details/{id}`
- `PUT /v1/WebsiteLead/details/{id}`
- `PUT /v1/WalkinLead/{id}` (if applicable)

### Java / JPA

1. Entity/DTO must include writable field mapped to column **`meeting_date`**:
   - `@JsonProperty("meetingDate")` or Jackson camelCase default
2. On **appointment create** (`POST /v1/Appointment`), optionally set `meeting_date` from `startTime` (same as you already set follow-up).
3. One-time **SQL backfill** for old rows (meeting substage + `follow_up_date` set, `meeting_date` null):

```sql
-- Example — adjust table name per entity
UPDATE add_leads
SET meeting_date = follow_up_date
WHERE meeting_date IS NULL
  AND follow_up_date IS NOT NULL
  AND milestone_sub_stage IN (
    'Meeting Scheduled',
    'Meeting Rescheduled',
    'Fix Appointment',
    'Design Refinement Round (Revisit)'
  );
```

4. **Acceptance:** After PUT §14 body, GET detail returns `meetingDate` and `dateField=meeting` filter includes the lead.

---

## Optional: dedicated endpoint (if full PUT is hard to change)

```http
PATCH /v1/leads/{leadType}/{id}/schedule-dates
{ "meetingDate": "2026-06-12T15:00:00", "followUpDate": "..." }
```

Frontend can call this instead of full detail PUT once shipped.

---

## Frontend diagnostic (via BFF)

After deploy, admin can probe one lead:

```http
POST /api/crm/lead/addlead/11/schedule-dates
Authorization: Cookie session (logged-in admin)
Content-Type: application/json

{ "meetingDate": "2026-06-12T15:00:00" }
```

Response includes `before`, `putBody`, `after`, and `persisted.meetingOk` — share JSON with backend team.

---

## Related docs

- `docs/DATE_FIELD_FILTER_BACKEND_HANDOFF.md` — filter contract
- `docs/DATE_FIELD_FILTER_FRONTEND_INTEGRATION.md` — §14 save contract

---

*Send this file to Project-ERP backend team. Frontend cannot write `meeting_date` until Hub PUT maps `meetingDate`.*

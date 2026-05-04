# Presales Roles Master Guide (New Frontend)

This document is a complete handover for **Presales roles** in this project:

- what each presales role does
- what access they should have
- which UI sections/tabs to show
- all relevant APIs
- request/response examples
- end-to-end workflows

Roles covered:

- `PRESALES_MANAGER`
- `PRESALES_EXECUTIVE`
- legacy alias: `PRE_SALES`

**Verified → sales handoff (tracking, read-only):** see [NEW_CRM_PRESALES_TRACKING_AND_READONLY.md](./NEW_CRM_PRESALES_TRACKING_AND_READONLY.md) — `PRE_SALES` and `PRESALES_EXECUTIVE` share list rules, `presalesTrackingReadOnly`, fullName/username matching, and `GET /v1/FormLead/details/{id}` rules (New CRM; legacy UI unchanged).

---

## 1) Quick role summary

## PRESALES_MANAGER

- Manages presales-level lead operations and team context.
- Primarily works with external/form lead flow in filter API.
- Can manage/view presales-related users (as allowed by UI/backend).

## PRESALES_EXECUTIVE

- Works assigned leads.
- Verifies leads (mandatory pincode).
- On verify, lead is assigned to Sales Executive (manual or auto).

## PRE_SALES (legacy)

- Legacy role alias.
- Should be normalized in frontend to `PRESALES_EXECUTIVE` for filters/dropdowns.

---

## 2) Authentication

All protected APIs require:

```http
Authorization: Bearer <token>
```

Bootstrap sequence:

1. `POST /api/auth/login`
2. Save token
3. `GET /api/auth/me`
4. Render role-based UI

---

## 3) UI behavior by Presales role

## 3.1 Presales Manager UI

Recommended tabs/sections:

- Leads tab (presales scope)
- Presales team/user-related views (where enabled)
- Assignment views allowed by backend rules

Hide:

- super-admin-only admin screens
- destructive admin actions (delete-all etc.)

## 3.2 Presales Executive UI

Recommended tabs/sections:

- Assigned lead list
- Lead details
- Verify lead modal (pincode + optional manual assign)
- Presales search (cross-source, if enabled)

Hide:

- admin/user management tabs
- delete-all / bulk destructive actions

---

## 4) Role visibility APIs (lead list/search)

## 4.1 Generic filter

```http
GET /v1/leads/filter?leadType=<type>&page=0&size=20&search=&verificationStatus=&reinquiry=
Authorization: Bearer <token>
```

Lead types:

- `formlead`
- `glead`
- `mlead`
- `addlead`
- `websitelead`

### Role-specific behavior

- `PRESALES_MANAGER`: restricted to `formlead` in this filter flow.
- `PRESALES_EXECUTIVE`: sees role-filtered data (assigned/eligible).

## 4.2 Presales cross-source search

```http
GET /v1/leads/presales-search?search=<query>&page=0&size=50
Authorization: Bearer <token>
```

Allowed roles:

- `PRESALES_MANAGER`
- `PRESALES_EXECUTIVE`

Response shape:

```json
{
  "content": [
    { "type": "formlead", "lead": { "id": 101, "name": "Rahul" } },
    { "type": "glead", "lead": { "id": 202, "name": "Rahul K" } }
  ],
  "totalElements": 2,
  "number": 0,
  "size": 50
}
```

---

## 5) Lead detail APIs used in UI

Per source:

- `GET /v1/FormLead/details/{id}`
- `GET /v1/Home1/details/{id}`
- `GET /v1/MetaLead/details/{id}`
- `GET /v1/AddLead/details/{id}`
- `GET /v1/WebsiteLead/details/{id}`

Used in:

- `lead-details.html` (legacy)
- new frontend lead details page

---

## 6) Verify lead APIs (Presales Executive core action)

Endpoints:

- `POST /v1/FormLead/verify/{id}`
- `POST /v1/Home1/verify/{id}`
- `POST /v1/MetaLead/verify/{id}`
- `POST /v1/AddLead/verify/{id}`
- `POST /v1/WebsiteLead/verify/{id}`

Rules:

- only `PRESALES_EXECUTIVE` can verify
- lead must be assigned to that user
- pincode mandatory
- optional `salesExecutiveId` for manual assignment

Request example:

```json
{
  "pincode": "560001",
  "salesExecutiveId": 52
}
```

Success:

```json
{
  "success": true,
  "message": "Lead verified successfully",
  "assignedTo": "Amit Kumar"
}
```

Failure examples:

```json
{ "success": false, "message": "Only Presales Executive can verify leads" }
```

```json
{ "success": false, "message": "You can only verify leads assigned to you" }
```

```json
{ "success": false, "message": "Pincode is required to verify lead. Please enter pincode." }
```

---

## 7) Verified / Unverified / Reinquiry filters

These are query filters on `/v1/leads/filter`.

## 7.1 Verified / Unverified

Query:

- `verificationStatus=verified`
- `verificationStatus=unverified`

## 7.2 Reinquiry

Query:

- `reinquiry=true`
- `reinquiry=false`

Backend logic:

- reinquiry is derived from `additionalLeadSources` being non-empty.

## 7.3 Reinquiry stats card API

```http
GET /v1/dashboard/reinquiry-stats
Authorization: Bearer <token>   // if enforced by gateway/frontend policy
```

Response:

```json
{
  "totalReinquiryLeads": 42,
  "formReinquiryLeads": 10,
  "googleReinquiryLeads": 9,
  "metaReinquiryLeads": 8,
  "addReinquiryLeads": 7,
  "websiteReinquiryLeads": 8
}
```

---

## 8) Presales user APIs (dropdowns and management)

```http
GET /api/auth/users-by-role?role=PRESALES_MANAGER
GET /api/auth/users-by-role?role=PRESALES_EXECUTIVE
Authorization: Bearer <token>
```

For creation flows (admin-side/presales-side as configured):

```http
POST /api/admin/create-pre-sales
Content-Type: application/json
Authorization: Bearer <token>
```

Request:

```json
{
  "name": "Ravi",
  "email": "ravi@example.com",
  "phone": "9999999999",
  "branch": "Pune",
  "managerId": 22,
  "username": "ravi.presales",
  "password": "Pass@123"
}
```

Common 400 reasons:

- duplicate email/username
- missing name/branch
- invalid parent role hierarchy

---

## 9) End-to-end Presales Executive workflow

1. Login (`/api/auth/login`)
2. Load role (`/api/auth/me`) -> role = `PRESALES_EXECUTIVE`
3. Open lead list (`/v1/leads/filter` role-scoped or presales search)
4. Open lead details (`/details/{id}` by lead type)
5. Verify lead via verify modal (`/verify/{id}`)
6. Backend validates + assigns to Sales Executive
7. UI refreshes lead status/tags/activity timeline

---

## 10) End-to-end Presales Manager workflow

1. Login + role load
2. Render presales manager allowed tabs only
3. Use allowed lead visibility API (primarily formlead in `/filter`)
4. Use presales search where required
5. Manage team-related dropdown/view operations based on role APIs

---

## 11) UI mismatch points and fixes

## Problem: Presales users missing in filters/dropdowns

Cause:

- legacy role alias `PRE_SALES` not normalized.

Fix:

- normalize role in frontend:
  - `PRE_SALES` -> `PRESALES_EXECUTIVE`

## Problem: Presales Manager getting 403 in lead list

Cause:

- frontend calling disallowed `leadType` via `/v1/leads/filter`.

Fix:

- restrict leadType options for this role.

## Problem: Verify button visible to wrong role

Fix:

- render verify action only for `PRESALES_EXECUTIVE`.

---

## 12) Frontend implementation checklist

- [ ] Always call `/api/auth/me` after login
- [ ] Role-normalize presales aliases in UI
- [ ] Route APIs by role
- [ ] Restrict leadType options for Presales Manager
- [ ] Verify action only for Presales Executive
- [ ] Enforce pincode in verify modal
- [ ] Handle `401/403/400/500` with clear UI messages

---

## 13) Final rule for new frontend

For Presales flows:

- **Backend controls security/visibility**
- **Frontend controls UX/tab visibility**

Both must be implemented together to avoid “works in UI but fails API” issues.

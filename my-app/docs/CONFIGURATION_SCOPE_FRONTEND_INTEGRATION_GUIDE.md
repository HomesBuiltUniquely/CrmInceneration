# Configuration Scope — Frontend Integration Guide

Backend APIs for **Requirement Scope** (Section 2) and **Reference & Inspiration** (Section 3) on the Configuration Scope page.

**Branch:** `view`  
**UI route:** `/Leads/{leadType}/{leadId}/configuration-scope`

**Related docs:**
- [CONFIGURATION_SCOPE_REQUIREMENT_REFERENCE_BACKEND_HANDOFF.md](./CONFIGURATION_SCOPE_REQUIREMENT_REFERENCE_BACKEND_HANDOFF.md) — original handoff + frontend file index
- [CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md](./CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md) — UI ↔ Hub field mapping (§1, §5)

---

## Base URL

| Environment | Base |
|-------------|------|
| Local Hub API | `http://localhost:8081` |
| BFF (Next.js) | Mirror under `/api/crm/lead/{leadType}/{id}/configuration-scope/...` |

Paths below are relative to the Hub API base.

**Also available under:** `/api/crm/lead/{leadType}/{id}/configuration-scope/...` (same handlers).

---

## Authentication

All endpoints require CRM login (same as floor plan / lead detail):

```http
Authorization: Bearer {token}
```

Token format: `Bearer session_{userId}_...`

---

## Lead types & ID

Use the numeric **database `id`** of the lead in the URL (not `leadIdentifier` like `FL-xxx` unless you resolve it first).

| CRM source | `leadType` path segment |
|------------|-------------------------|
| Form / External | `formlead` |
| Google Ads | `glead` |
| Meta Ads | `mlead` |
| Add Lead | `addlead` |
| Website | `websitelead` |
| Walk-in | `walkinlead` |
| WhatsApp | `whatsapplead` |

Aliases also accepted (e.g. `form`, `wl`, `wa`) — response `leadType` uses canonical names above.

Response includes:
- `leadId` — numeric DB id (string in JSON)
- `leadIdentifier` — business id e.g. `FL-abc123`, `GL-xyz789`

---

## Database model (for reference)

**One table only:** `configuration_scope` (1 row per lead, `lead_type` + `lead_id` unique).

Collections are stored as **JSON columns** inside that single row (Java `List<>`, not separate DB tables):

| Column | Content |
|--------|---------|
| `available_room_catalog` | JSON array of room name strings |
| `selected_rooms` | JSON array (rooms + nested units) |
| `misc_addons` | JSON array of add-on strings |
| `scope_references` | JSON array (file metadata + S3 keys) |
| `kitchen_layout`, `material_finish`, `aesthetic_notes` | plain text columns |
| `family_contact_name`, `family_contact_phone` | family contact (§1) |
| `project_understanding`, `design_style_preference`, `expected_timeline` | basic understanding (§1) |
| `internal_executive_notes`, `sales_risk_notes`, `design_handoff_notes` | internal notes (§5) |

`bookingType` is stored on the **lead row** (not `configuration_scope`); included in requirements GET/PUT for convenience.

Floor plan remains on the lead row — **unchanged** existing API (`CRM_Floor_Plan/` prefix).

**Reference files S3 location:**

```
s3://hubinterior-quote-2026/Configure scope/{leadType}/{leadId}/{uuid}-{filename}
```

Example `s3Key` in API response:

```
Configure scope/formlead/123/a1b2c3d4-living-inspo.jpg
```

---

## UI field mapping (frontend ↔ Hub)

Hub exposes §1 and §5 fields on the **same** requirements GET/PUT (not separate endpoints).

| UI section | UI label | Hub JSON key | Notes |
|------------|----------|--------------|-------|
| Lead sidebar — Family Contact | Name | `familyContactName` | |
| Lead sidebar — Family Contact | Phone | `familyContactPhone` | Also on lead as `altPhoneNumber` |
| Lead sidebar — Family Contact | Role (Spouse) | — | **Frontend-only** (no Hub column) |
| §1 Basic Understanding | Property / family text | `projectUnderstanding` | Combine property + family size in one field or split in UI |
| §1 Basic Understanding | Design style | `designStylePreference` | Optional; max 200 chars |
| §1 Basic Understanding | Timeline | `expectedTimeline` | e.g. `90 Days (Standard)` |
| §1 Basic Understanding | BHK | — | Read lead `configuration` |
| §1 Basic Understanding | Type | `bookingType` | Stored on lead row |
| §1 Basic Understanding | WFH / Pet | — | **Frontend-only** |
| §5 Internal Notes | Personality | `designStylePreference` | Map enum → string |
| §5 Internal Notes | Competition | `salesRiskNotes` | |
| §5 Internal Notes | Executive summary | `designHandoffNotes` | |
| §5 Internal Notes | Closure Hot/Warm/Cold | — | **Frontend-only** |
| §5 Internal Notes | (extra) | `internalExecutiveNotes` | Available on API; optional in UI |

---

## 1. Requirement Scope

### GET requirements

```http
GET /v1/leads/{leadType}/{id}/configuration-scope/requirements
Authorization: Bearer {token}
```

**200 OK** — first load (no saved data yet):

```json
{
  "success": true,
  "leadId": "123",
  "leadIdentifier": "FL-abc123",
  "leadType": "formlead",
  "availableRoomCatalog": [
    "Living Room",
    "Modular Kitchen",
    "Foyer",
    "Master Bedroom",
    "Guest Bedroom"
  ],
  "selectedRooms": [],
  "miscAddOns": [],
  "kitchenLayout": null,
  "materialFinish": null,
  "familyContactName": null,
  "familyContactPhone": null,
  "bookingType": "Full Home",
  "projectUnderstanding": null,
  "designStylePreference": null,
  "expectedTimeline": null,
  "internalExecutiveNotes": null,
  "salesRiskNotes": null,
  "designHandoffNotes": null,
  "version": 0,
  "updatedAt": null,
  "updatedBy": null
}
```

### PUT requirements (full replace of scope fields)

```http
PUT /v1/leads/{leadType}/{id}/configuration-scope/requirements
Authorization: Bearer {token}
Content-Type: application/json
```

**Request body:**

```json
{
  "version": 1,
  "availableRoomCatalog": ["Living Room", "Modular Kitchen", "Custom Study"],
  "selectedRooms": [
    {
      "id": "room-uuid-1",
      "roomName": "Living Room",
      "iconLabel": "🛋",
      "sortOrder": 0,
      "units": [{ "label": "TV Unit", "selected": true }],
      "falseCeilingRequired": false,
      "notes": "Warm lighting"
    }
  ],
  "miscAddOns": ["Painting"],
  "kitchenLayout": "L-Shaped with Island",
  "materialFinish": "High Gloss Acrylic",
  "familyContactName": "Priya Sharma",
  "familyContactPhone": "9876543210",
  "bookingType": "Full Home",
  "projectUnderstanding": "3BHK full interior, move-in in 4 months",
  "designStylePreference": "Modern minimal",
  "expectedTimeline": "4 months",
  "internalExecutiveNotes": "High intent client",
  "salesRiskNotes": "Budget sensitive on kitchen",
  "designHandoffNotes": "Prefer warm wood tones"
}
```

- Send `version` from last GET for optimistic locking.
- **409 Conflict** if stale — refresh and retry.
- Omitting a room in `selectedRooms` removes it (full replace).
- `bookingType` on PUT updates the **lead** record (not `configuration_scope`). `walkinlead` has no `bookingType` column — value is ignored on save.

**Validation limits:**

| Field | Limit |
|-------|-------|
| `roomName` | required, max 120 chars |
| `units` per room | max 30 |
| `units[].label` | max 80 chars |
| `notes` per room | max 4000 chars |
| `miscAddOns` | max 20 items |
| `kitchenLayout`, `materialFinish`, `designStylePreference`, `expectedTimeline` | max 200 chars each |
| `familyContactName` | max 120 chars |
| `familyContactPhone` | max 20 chars |
| `bookingType` | max 200 chars |
| `projectUnderstanding` | max 2000 chars |
| `internalExecutiveNotes` | max 4000 chars |
| `salesRiskNotes`, `designHandoffNotes` | max 2000 chars each |

---

## 2. Reference & Inspiration

### GET references

```http
GET /v1/leads/{leadType}/{id}/configuration-scope/references
Authorization: Bearer {token}
```

### POST upload reference

```http
POST /v1/leads/{leadType}/{id}/configuration-scope/references
Content-Type: multipart/form-data
file: <binary>
```

- Allowed: JPG, PNG, PDF — max 10 MB — max 20 files per lead
- **201 Created** — response includes updated `references` list and new `reference` object
- Use `originalFileName` for UI display

### DELETE reference

```http
DELETE /v1/leads/{leadType}/{id}/configuration-scope/references/{referenceId}
```

### PUT aesthetic notes

```http
PUT /v1/leads/{leadType}/{id}/configuration-scope/references
Content-Type: application/json

{ "aestheticNotes": "Warm wood textures..." }
```

### Stream / preview

```http
GET /v1/leads/{leadType}/{id}/configuration-scope/references/{referenceId}/content
Authorization: Bearer {token}
```

Use `viewUrl` from GET with same auth header.

---

## 3. Floor plan (unchanged)

| Method | Path |
|--------|------|
| GET | `/v1/leads/{leadType}/{id}/floor-plan` |
| POST | `/v1/leads/{leadType}/{id}/floor-plan` |
| DELETE | `/v1/leads/{leadType}/{id}/floor-plan` |

---

## BFF routes (Next.js)

```
GET/PUT  /api/crm/lead/[leadType]/[id]/configuration-scope/requirements
GET/POST/PUT /api/crm/lead/[leadType]/[id]/configuration-scope/references
DELETE   /api/crm/lead/[leadType]/[id]/configuration-scope/references/[referenceId]
GET      /api/crm/lead/[leadType]/[id]/configuration-scope/references/[referenceId]/content
```

Frontend client: `lib/configuration-scope-client.ts`

---

## Error format

```json
{ "success": false, "error": "message" }
```

| Status | When |
|--------|------|
| 401 | No token |
| 400 | Validation / bad file |
| 404 | Reference not found |
| 409 | Stale version on PUT |
| 503 | S3 not configured |

---

## Backend package layout

```
Pojoclasses/Configuration/     — ConfigurationScope entity + JSON data models
InterfacesRepo/Configuration/
Services/Configuration/
Controlers/Configuration/
dto/Configuration/
```

**DB:** only `configuration_scope` table. Old child tables (`scope_room_catalog`, etc.) can be dropped if they were auto-created earlier.

---

## Frontend implementation status

| Area | Status |
|------|--------|
| §2 Requirement Scope (rooms, units, add-ons, kitchen) | **Wired** |
| §3 References + aesthetic notes | **Wired** |
| §1 / §5 fields on requirements GET/PUT | **Wired** — autosave via `configuration-scope-client` |
| Family Contact on lead detail V2 | Pending — read/write via requirements or lead PUT |
| WFH, Pet, Closure Probability | Frontend-only |
| §4 Financial (budget slider) | Uses lead `budget` — wired |

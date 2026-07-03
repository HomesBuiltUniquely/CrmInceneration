# Configuration Scope — Requirement Scope & Reference & Inspiration (Backend Handoff)

**Status (2026-06-17):** **Frontend wired** to Hub `view` branch APIs for §2 Requirement Scope and §3 Reference & Inspiration.  
**Audience:** Hub / Spring backend team + frontend maintainers  
**Frontend repo:** `CrmInceneration/my-app`  
**UI route:** `/Leads/{leadType}/{leadId}/configuration-scope`  
**Primary UI:** `app/Components/CrmLeadDetailsV2/NewConfigurationScopePage.tsx`  
**Client:** `lib/configuration-scope-client.ts`  
**BFF:** `app/api/crm/lead/[leadType]/[id]/configuration-scope/...`

---

## 1. Executive summary

The new **Configuration Scope** page is a multi-section wizard for sales/design to capture structured scope before proposal.  
Five sections are shown in the UI sidebar:

| # | Section | Backend (`view`) | Frontend |
|---|---------|------------------|----------|
| 1 | Basic Understanding | **GET/PUT** `requirements` (`projectUnderstanding`, `expectedTimeline`, `bookingType`) | **Wired** — property/family, timeline, type; WFH/Pet frontend-only |
| 2 | **Requirement Scope** | **GET/PUT** `/configuration-scope/requirements` | **Wired** — rooms, units, add-ons, kitchen, autosave |
| 3 | **Reference & Inspiration** | **GET/POST/PUT/DELETE** `/configuration-scope/references` | **Wired** — upload, gallery, preview modal, notes |
| 4 | Financial Guardrails | None (uses lead `budget`) | Wired display + luxury slider from budget |
| 5 | Internal Executive Notes | **GET/PUT** `requirements` (`designStylePreference`, `salesRiskNotes`, `designHandoffNotes`, `internalExecutiveNotes`) | **Wired** — autosave; Closure Probability frontend-only |

**Hub field mapping:** see **[CONFIGURATION_SCOPE_FRONTEND_INTEGRATION_GUIDE.md](./CONFIGURATION_SCOPE_FRONTEND_INTEGRATION_GUIDE.md)** and **[CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md](./CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md)**.

**Hub storage (2026):** single `configuration_scope` row per lead; catalog/rooms/add-ons/references stored as **JSON columns** (not separate child tables). API JSON shape unchanged for the frontend.

**Already working without new scope APIs:**

- **Floor plan** inside Requirement Scope uses existing endpoints:
  - `GET/POST/DELETE /api/crm/lead/{leadType}/{id}/floor-plan` (BFF → Hub)
- **Booking Type** in Basic Understanding uses existing lead detail:
  - `GET/PUT /api/crm/lead/{leadType}/{id}` → field `bookingType`

---

## 2. Frontend context

### Route

```
GET /Leads/formlead/123/configuration-scope   → NewConfigurationScopePage
```

`leadType` is one of: `formlead`, `glead`, `mlead`, `addlead`, `websitelead`, `walkinlead`, `whatsapplead`.

### User flow

1. User opens lead detail V2 → Experience phase → **Configure Scope**
2. Lands on Configuration Scope page with left nav (sections 1–5)
3. Sections scroll; data should **load on page open** and **save on edit** (per section or autosave)

### Legacy note

Lead detail today has a flat `requirements: string[]` on GET/PUT (`requirements` / `requirementList`).  
That is **not sufficient** for the new room-level Requirement Scope UI.  
Recommend a **new structured resource** (below) rather than overloading the string array.

---

## 3. Section 2 — Requirement Scope (UI field inventory)

All fields below are visible in `RequirementScopeSection` + `ScopeExtrasSection` + `RoomConfigCard`.

### 3.1 Spaces to be designed

**Left column — room picker**

| UI label | Type | Notes |
|----------|------|-------|
| Available rooms | `string[]` catalog | e.g. Living Room, Modular Kitchen, Foyer, Master Bedroom, Guest Bedroom — backend may provide master list + custom rooms |
| Selected rooms | `string[]` | Subset toggled “on” for this lead |
| Add New Room | `string` | Free-text custom room name added to catalog for this lead |

**Right column — per selected room (`RoomConfigCard`)**

| UI label | Field | Type | Notes |
|----------|-------|------|-------|
| Room name | `roomName` | `string` | Display title |
| Room icon | `iconLabel` | `string` optional | Short label/emoji for UI only (optional persist) |
| Units required | `units` | `array` | Each: `{ label: string, selected: boolean }` e.g. TV Unit, Sofa, Base Units |
| Add unit | `units[].label` | `string` | Custom unit label per room |
| False ceiling | `falseCeilingRequired` | `boolean` | Checkbox |
| Specific room notes | `notes` | `string` | Free text |

**Room removal:** UI has delete control per room card → backend should support remove room from scope.

### 3.2 Miscellaneous add-ons

| UI label | Type | Notes |
|----------|------|-------|
| Add-ons | `string[]` (selected) | Catalog examples: Painting, Granite, Kitchen Tile, Wallpaper, Appliance, Wooden Flooring |

### 3.3 Floor plan (already on backend)

| UI | Existing API | Notes |
|----|--------------|-------|
| Upload New Plan | `POST .../floor-plan` | PDF, JPG, PNG max 10MB |
| View Floor Plan | `GET .../floor-plan` | Returns `viewUrl`, `openUrl`, `floorPlanS3Key` |
| Display file name | Frontend localStorage today | **Recommend backend store `originalFileName` on upload response** |

### 3.4 Kitchen / finish (scope-level, not per room)

| UI label | Field | Type | Example values |
|----------|-------|------|----------------|
| Kitchen Layout | `kitchenLayout` | `string` enum or free text | `L-Shaped with Island` |
| Material Finish | `materialFinish` | `string` enum or free text | `High Gloss Acrylic` |

---

## 4. Proposed API — Requirement Scope

### Option A (recommended): dedicated sub-resource

Keeps lead detail payload small and allows partial saves.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/leads/{leadType}/{leadId}/configuration-scope/requirements` | Load full requirement scope |
| `PUT` | `/v1/leads/{leadType}/{leadId}/configuration-scope/requirements` | Replace or upsert full document |
| `PATCH` | `/v1/leads/{leadType}/{leadId}/configuration-scope/requirements` | Partial update (optional) |

BFF (Next.js) should mirror as:

```
GET/PUT /api/crm/lead/{leadType}/{id}/configuration-scope/requirements
```

### Request / response body (JSON)

```json
{
  "leadId": "12345",
  "leadType": "formlead",
  "version": 3,
  "updatedAt": "2026-06-17T14:30:00+05:30",
  "updatedBy": "Vikram Singh",
  "selectedRooms": [
    {
      "id": "room-uuid-1",
      "roomName": "Living Room",
      "iconLabel": "🛋",
      "sortOrder": 0,
      "units": [
        { "label": "TV Unit", "selected": true },
        { "label": "Sofa", "selected": false }
      ],
      "falseCeilingRequired": false,
      "notes": "Minimalist vibe, warm lighting"
    },
    {
      "id": "room-uuid-2",
      "roomName": "Modular Kitchen",
      "iconLabel": "B",
      "sortOrder": 1,
      "units": [
        { "label": "Base Units", "selected": true },
        { "label": "Wall Units", "selected": true }
      ],
      "falseCeilingRequired": true,
      "notes": "Quartz countertop preferred"
    }
  ],
  "availableRoomCatalog": [
    "Living Room",
    "Modular Kitchen",
    "Foyer",
    "Master Bedroom",
    "Guest Bedroom"
  ],
  "miscAddOns": ["Painting", "Granite"],
  "kitchenLayout": "L-Shaped with Island",
  "materialFinish": "High Gloss Acrylic"
}
```

### Validation rules

| Rule | Detail |
|------|--------|
| Auth | Same JWT / role rules as lead detail GET/PUT |
| `roomName` | Required per selected room; max 120 chars |
| `units` | Max 30 units per room; `label` max 80 chars |
| `notes` | Max 4000 chars per room |
| `miscAddOns` | Max 20 items |
| `kitchenLayout`, `materialFinish` | Max 200 chars each |
| Optimistic locking | Optional `version` integer; reject PUT if stale (`409 Conflict`) |

### Suggested DB shape

One row per lead (or JSON column on lead extension table):

- `lead_id`, `lead_type`, `payload JSONB`, `version`, `updated_at`, `updated_by`

Alternatively normalized tables: `scope_room`, `scope_room_unit`, `scope_addon` — JSONB is acceptable for v1.

---

## 5. Section 3 — Reference & Inspiration (UI field inventory)

Visible in `ReferenceInspirationSection`.

| UI label | Field | Type | Notes |
|----------|-------|------|-------|
| Upload zone | `references[]` | `array` | Multi-file upload |
| Reference file | `id`, `fileName`, `mimeType`, `sizeBytes`, `s3Key`, `viewUrl`, `thumbnailUrl` | | Same pattern as floor plan |
| Reference gallery | ordered list of references | | Grid with preview + label |
| Additional aesthetic notes | `aestheticNotes` | `string` | Textarea |

### Upload constraints (match UI copy)

- **Allowed:** JPG, PNG, PDF  
- **Max size:** 10 MB per file  
- **Max files:** recommend 20 per lead (confirm with product)

---

## 6. Proposed API — Reference & Inspiration

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/leads/{leadType}/{leadId}/configuration-scope/references` | List metadata + notes |
| `POST` | `/v1/leads/{leadType}/{leadId}/configuration-scope/references` | Upload one file (`multipart/form-data`) |
| `DELETE` | `/v1/leads/{leadType}/{leadId}/configuration-scope/references/{referenceId}` | Remove one file |
| `PUT` | `/v1/leads/{leadType}/{leadId}/configuration-scope/references` | Update `aestheticNotes` only (optional) |

BFF mirror:

```
GET    /api/crm/lead/{leadType}/{id}/configuration-scope/references
POST   /api/crm/lead/{leadType}/{id}/configuration-scope/references
DELETE /api/crm/lead/{leadType}/{id}/configuration-scope/references/{referenceId}
PUT    /api/crm/lead/{leadType}/{id}/configuration-scope/references
```

### GET response example

```json
{
  "leadId": "12345",
  "leadType": "formlead",
  "aestheticNotes": "Warm wood textures, indirect cove lighting in living area.",
  "references": [
    {
      "id": "ref-uuid-1",
      "fileName": "REF_01.JPG",
      "originalFileName": "living-inspo.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 2457600,
      "s3Key": "CRM_Reference/...",
      "viewUrl": "/v1/leads/formlead/12345/configuration-scope/references/ref-uuid-1/content",
      "thumbnailUrl": "/v1/leads/formlead/12345/configuration-scope/references/ref-uuid-1/thumbnail",
      "uploadedAt": "2026-06-12T10:15:00+05:30",
      "uploadedBy": "Meghana"
    }
  ],
  "updatedAt": "2026-06-17T14:45:00+05:30"
}
```

### POST upload (multipart)

```
POST /v1/leads/{leadType}/{leadId}/configuration-scope/references
Content-Type: multipart/form-data

file: <binary>
```

Response `201` with single `references[]` item object (same shape as GET item).

**Important:** Return **`originalFileName`** from the uploaded file so UI can show `test.png` instead of S3 UUID.

---

## 7. Unified alternative (single document API)

If you prefer one endpoint for the whole Configuration Scope page:

| Method | Path |
|--------|------|
| `GET` | `/v1/leads/{leadType}/{leadId}/configuration-scope` |
| `PUT` | `/v1/leads/{leadType}/{leadId}/configuration-scope` |

Body:

```json
{
  "basicUnderstanding": { },
  "requirements": { },
  "references": { },
  "financialGuardrails": { },
  "internalNotes": { }
}
```

**Recommendation:** Still use **separate file upload endpoints** for references (and keep floor plan separate).  
Metadata + notes can live in GET/PUT document; binaries via POST multipart.

---

## 8. Frontend integration (completed)

1. `lib/configuration-scope-client.ts` — typed GET/PUT/POST/DELETE helpers
2. BFF routes under `app/api/crm/lead/[leadType]/[id]/configuration-scope/...`
3. `NewConfigurationScopePage` — load on mount, debounced autosave, 409 retry, default rooms (Living Room + Modular Kitchen), finalize → save + redirect, print PDF
4. `ReferenceViewModal` — reference preview (same pattern as floor plan)
5. Floor plan + `bookingType` unchanged on existing lead APIs

---

## 9. Acceptance criteria (QA)

### Requirement Scope

- [ ] GET returns saved rooms, units, add-ons, kitchen layout, material finish for a lead
- [ ] PUT persists changes; refresh page shows same data
- [ ] Custom room name appears in catalog for that lead
- [ ] Removing a room removes it from GET response
- [ ] Unauthorized roles cannot read/write (same as lead detail)
- [ ] Floor plan still works independently (no regression)

### Reference & Inspiration

- [ ] POST uploads JPG/PNG/PDF ≤ 10MB; rejects invalid type/size
- [ ] GET lists all references with `originalFileName` and view URLs
- [ ] DELETE removes file from storage and GET list
- [ ] `aestheticNotes` persists via PUT
- [ ] Gallery order stable (sort by `uploadedAt` or explicit `sortOrder`)

---

## 10. Open questions for product / backend

1. **Master room catalog** — global list vs per-lead custom only?
2. **Unit catalog** — predefined per room type or fully free-text?
3. **Kitchen layout / material finish** — fixed enums or free text?
4. **Versioning / audit** — need history of scope changes for compliance?
5. **Designer read-only access** — same as lead detail visibility rules?
6. **Migrate legacy `requirements: string[]`** — one-time import or dual-write period?

---

## 11. Related frontend files (for reviewers)

| File | Purpose |
|------|---------|
| `app/Components/CrmLeadDetailsV2/NewConfigurationScopePage.tsx` | Main page; sections 1–5 UI |
| `app/Components/CrmLeadDetailsV2/ConfigurationScopeFloorPlan.tsx` | Floor plan upload/view (wired) |
| `app/Components/CrmLeadDetailsV2/FloorPlanViewModal.tsx` | Floor plan preview modal |
| `app/Leads/[...segments]/page.tsx` | Route to configuration scope |
| `lib/lead-details-client.ts` | Existing lead + floor plan clients |
| `lib/lead-detail-mapper.ts` | Legacy `requirements[]` on lead |

---

## 12. Priority recommendation

| Priority | Deliverable |
|----------|-------------|
| **Done** | Requirement Scope GET/PUT + references upload/list/delete + aesthetic notes |
| **P1** | **8 pending fields** — [CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md](./CONFIGURATION_SCOPE_PENDING_FIELDS_BACKEND_HANDOFF.md) |
| P2 | Optional unified `GET/PUT /configuration-scope` document |
| P3 | Master catalogs (rooms, units, add-ons, kitchen layouts) as lookup endpoints |

**Requirement Scope and Reference & Inspiration are live on the frontend.** Remaining work is the 8-field handoff doc above plus optional catalog lookups.

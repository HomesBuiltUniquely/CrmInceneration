# Configuration Scope & Lead V2 — Pending Backend Fields (Handoff)

**Status (2026-06-17):** **Not implemented on Hub** — frontend shows mock/read-only UI until APIs exist.  
**Audience:** Hub / Spring backend team  
**Companion doc:** [CONFIGURATION_SCOPE_REQUIREMENT_REFERENCE_BACKEND_HANDOFF.md](./CONFIGURATION_SCOPE_REQUIREMENT_REFERENCE_BACKEND_HANDOFF.md) (§2 Requirement Scope + §3 References — **already wired**)

**Frontend repo:** `CrmInceneration/my-app`  
**UI surfaces:**
- Lead detail V2 → `app/Components/CrmLeadDetailsV2/NewLeadDetailPage.tsx` (Family Contact card)
- Configuration Scope → `app/Components/CrmLeadDetailsV2/NewConfigurationScopePage.tsx` (§1 Basic Understanding, §4 Financial, §5 Internal Notes)

---

## 1. Executive summary

Product and frontend agreed on **8 new persisted fields** for the backend.  
Several UI controls are **frontend-only** (no database column).

| Category | New DB fields | Frontend-only (no DB) |
|----------|---------------|------------------------|
| Lead detail — Family Contact | **2** | — |
| Config scope — Basic Understanding | **3** | WFH Setup, Pet Friendly |
| Config scope — Internal Executive Notes | **3** | Closure Probability (Hot/Warm/Cold) |
| **Total new fields** | **8** | **3 UI-only** |

**Reuse existing lead fields (no new column):**

| UI label | Existing Hub / lead detail field |
|----------|--------------------------------|
| Family contact phone | `altPhoneNumber` / `altPhone` |
| BHK Type | `configuration` |
| Type (Apartment / Renovation / Kitchen) | `bookingType` |
| Budget / investment range (§4) | `budget` |
| Property location (sidebar) | `propertyLocation` (separate from property name/site) |

---

## 2. Field inventory — 8 new backend fields

### 2.1 Lead detail — Family Contact (2 fields)

Shown on **Lead Detail V2** left sidebar (`FamilyContactCard`).  
**Not** on the Configuration Scope page.

| # | Proposed API key (camelCase) | DB column (snake_case) | Type | Max | Required | UI example |
|---|------------------------------|-------------------------|------|-----|----------|------------|
| 1 | `familyMemberName` | `family_member_name` | `string` | 120 | optional | Ananya Sharma |
| 2 | `familyMemberRole` | `family_member_role` | `string` | 60 | optional | Spouse |

**Phone:** map UI to existing `altPhoneNumber` on lead GET/PUT — **do not add a third phone field.**

```json
{
  "familyMemberName": "Ananya Sharma",
  "familyMemberRole": "Spouse",
  "altPhoneNumber": "+919876543210"
}
```

**API:** extend existing lead detail resource (same auth as `GET/PUT /v1/{LeadType}/details/{id}`).

---

### 2.2 Configuration scope — Basic Understanding (3 fields)

Shown in Configuration Scope **§1 Basic Understanding**.  
Store on the same `configuration_scope` row as requirements/references (recommended JSON key `basicUnderstanding`).

| # | Proposed API key | Type | Max | Required | UI example |
|---|------------------|------|-----|----------|------------|
| 3 | `propertyNameSite` | `string` | 200 | optional | Sharma Heights, Block C |
| 4 | `familySizeDetails` | `string` | 500 | optional | 2 Adults, 1 Child, 1 Pet |
| 5 | `timelineExpectation` | `string` enum | 40 | optional | `90_DAYS_STANDARD` |

**Do not persist (frontend UI state only):**

| UI control | Reason |
|------------|--------|
| WFH Setup (checkbox) | Product: handle in frontend only |
| Pet Friendly (checkbox) | Product: handle in frontend only |

**Read from lead detail (no new scope field):**

| UI label | Source |
|----------|--------|
| BHK Type | Lead `configuration` (e.g. `3 BHK`) |
| Type | Lead `bookingType` (e.g. `APARTMENT`) — already wired via lead PUT |

**Suggested `timelineExpectation` values:**

| UI label | Stored value |
|----------|--------------|
| 45 Days (Express) | `45_DAYS_EXPRESS` |
| 90 Days (Standard) | `90_DAYS_STANDARD` |

```json
{
  "basicUnderstanding": {
    "propertyNameSite": "Sharma Heights, Block C",
    "familySizeDetails": "2 Adults, 1 Child, 1 Pet",
    "timelineExpectation": "90_DAYS_STANDARD",
    "version": 1,
    "updatedAt": "2026-06-17T18:00:00+05:30",
    "updatedBy": "Vikram Singh"
  }
}
```

---

### 2.3 Configuration scope — Internal Executive Notes (3 fields)

Shown in Configuration Scope **§5 Internal Executive Notes**.  
Recommended JSON key `internalNotes` on `configuration_scope`.

| # | Proposed API key | Type | Max | Required | UI example |
|---|------------------|------|-----|----------|------------|
| 6 | `personalityType` | `string` enum | 40 | optional | `ANALYTICAL` |
| 7 | `competition` | `string` | 500 | optional | Livspace, HomeLane etc. |
| 8 | `executiveSummaryForDesigner` | `string` (text) | 8000 | optional | Free text for designer handoff |

**Do not persist (frontend UI state only):**

| UI control | Reason |
|------------|--------|
| Closure Probability (Hot / Warm / Cold) | Product: frontend-only toggle; not saved to DB |

**Suggested `personalityType` values (extend as needed):**

| UI label | Stored value |
|----------|--------------|
| Analytical (Data Driven) | `ANALYTICAL` |
| Relationship Driven | `RELATIONSHIP` |
| Price Sensitive | `PRICE_SENSITIVE` |
| Design Focused | `DESIGN_FOCUSED` |

```json
{
  "internalNotes": {
    "personalityType": "ANALYTICAL",
    "competition": "Livspace, HomeLane etc.",
    "executiveSummaryForDesigner": "Client wants warm lighting in living; negotiate on modular kitchen timeline.",
    "version": 1,
    "updatedAt": "2026-06-17T18:05:00+05:30",
    "updatedBy": "Vikram Singh"
  }
}
```

---

## 3. Section §4 Financial Guardrails — no new fields

| UI | Backend source |
|----|----------------|
| Total Investment Range | Lead `budget` (connection phase dropdown string) |
| Value Focus ↔ Luxury Focus slider | **Computed on frontend** from budget option (no DB column) |

Frontend parser: `lib/lead-budget-display.ts`.

---

## 4. Storage recommendation

### Option A (recommended): extend `configuration_scope` row

Same pattern as existing `requirements` and `references` JSON columns.

| Storage | Keys |
|---------|------|
| `leads` / lead detail table | `family_member_name`, `family_member_role` (+ existing `alt_phone_number`) |
| `configuration_scope` table | JSON: `basic_understanding`, `internal_notes` |

### Option B: unified configuration-scope document

Single GET/PUT body (see companion doc §7):

```json
{
  "basicUnderstanding": { },
  "requirements": { },
  "references": { },
  "internalNotes": { }
}
```

**Recommendation:** Keep **binary uploads** (references, floor plan) on separate endpoints.  
Metadata for §1 and §5 can be sub-objects on scope GET/PUT.

---

## 5. Proposed API endpoints

### 5.1 Lead detail (family contact)

Extend existing:

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/v1/{LeadType}/details/{id}` | Return `familyMemberName`, `familyMemberRole` |
| `PUT` | `/v1/{LeadType}/details/{id}` | Accept same keys |

BFF (already exists): `GET/PUT /api/crm/lead/{leadType}/{id}`

### 5.2 Configuration scope — Basic Understanding

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/leads/{leadType}/{leadId}/configuration-scope/basic-understanding` | Load §1 |
| `PUT` | `/v1/leads/{leadType}/{leadId}/configuration-scope/basic-understanding` | Save §1 |

Or include `basicUnderstanding` in unified `GET/PUT .../configuration-scope`.

BFF mirror:

```
GET/PUT /api/crm/lead/{leadType}/{id}/configuration-scope/basic-understanding
```

### 5.3 Configuration scope — Internal Executive Notes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/leads/{leadType}/{leadId}/configuration-scope/internal-notes` | Load §5 |
| `PUT` | `/v1/leads/{leadType}/{leadId}/configuration-scope/internal-notes` | Save §5 |

BFF mirror:

```
GET/PUT /api/crm/lead/{leadType}/{id}/configuration-scope/internal-notes
```

### Auth & validation

- Same JWT and role rules as lead detail and existing configuration-scope requirements.
- Optional `version` + `409 Conflict` on stale PUT (match requirements API).
- Empty string = clear field; omit key = no change on PATCH-style updates if supported.

---

## 6. Frontend integration plan (after Hub ships)

| Area | Frontend file | Action when API ready |
|------|---------------|------------------------|
| Family contact | `NewLeadDetailPage.tsx` → `FamilyContactCard` | Load from lead; edit + save via lead PUT |
| Basic Understanding | `NewConfigurationScopePage.tsx` | Replace mock inputs; wire GET/PUT |
| BHK / Type | Same page | Read-only from lead `configuration` + `bookingType` |
| WFH / Pet | Same page | Local React state only |
| Internal notes | `NewConfigurationScopePage.tsx` | Wire GET/PUT; closure probability local state |
| Financial §4 | Same page | Already uses lead `budget` |

New client helpers (to be added): `lib/configuration-scope-client.ts` extensions or sibling module.

---

## 7. Acceptance criteria (QA)

### Family contact

- [ ] GET lead detail returns `familyMemberName`, `familyMemberRole`, `altPhoneNumber`
- [ ] PUT persists family name/role; refresh shows same values
- [ ] Phone displays from `altPhoneNumber` without a duplicate column

### Basic Understanding

- [ ] GET returns `propertyNameSite`, `familySizeDetails`, `timelineExpectation`
- [ ] PUT persists; page refresh shows saved data
- [ ] BHK displays from lead `configuration` (not duplicated in scope JSON)
- [ ] Type displays from lead `bookingType`
- [ ] WFH / Pet Friendly toggles work in UI but do not appear in API payload

### Internal Executive Notes

- [ ] GET returns `personalityType`, `competition`, `executiveSummaryForDesigner`
- [ ] PUT persists all three
- [ ] Hot/Warm/Cold closure control works in UI but is not stored in Hub

### Financial Guardrails

- [ ] Investment label reflects lead `budget` (no new scope field)
- [ ] No regression on existing requirements/references APIs

---

## 8. Quick reference — what NOT to build

| Item | Decision |
|------|----------|
| `wfhSetup` column | **No** — frontend only |
| `petFriendly` column | **No** — frontend only |
| `closureProbability` column | **No** — frontend only |
| `familyContactPhone` column | **No** — use `altPhoneNumber` |
| `bhkType` on scope | **No** — use lead `configuration` |
| `bookingType` on scope | **No** — use lead `bookingType` |
| Budget on scope | **No** — use lead `budget` |

---

## 9. Related frontend files

| File | Purpose |
|------|---------|
| `app/Components/CrmLeadDetailsV2/NewLeadDetailPage.tsx` | Family Contact card (mock) |
| `app/Components/CrmLeadDetailsV2/NewConfigurationScopePage.tsx` | §1, §4, §5 UI |
| `lib/lead-detail-mapper.ts` | Lead GET/PUT field mapping |
| `lib/configuration-scope-client.ts` | Existing scope APIs (§2, §3) |
| `lib/lead-budget-display.ts` | §4 budget display + luxury slider |

---

## 10. Priority

| Priority | Deliverable |
|----------|-------------|
| **P1** | Lead detail: `familyMemberName`, `familyMemberRole` |
| **P1** | Scope: `basicUnderstanding` (3 fields) + GET/PUT |
| **P2** | Scope: `internalNotes` (3 fields) + GET/PUT |
| **P3** | Unified scope document OR single GET for all sections (optional consolidation) |

**Total new persisted fields: 8**

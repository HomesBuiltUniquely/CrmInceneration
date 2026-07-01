# Configuration Scope — Hub Field Mapping (Backend `view` branch)

**Status (2026-06-17):** Hub implements §1 + §5 fields on **`GET/PUT .../configuration-scope/requirements`** (same endpoint as §2).  
**Authoritative API doc:** [CONFIGURATION_SCOPE_FRONTEND_INTEGRATION_GUIDE.md](./CONFIGURATION_SCOPE_FRONTEND_INTEGRATION_GUIDE.md)

---

## Summary

Hub uses **one** `configuration_scope` row per lead.  
§1 Basic Understanding, §2 Requirement Scope, and §5 Internal Notes share the **requirements** GET/PUT — no separate sub-resources.

| Category | Hub fields | Frontend-only (no DB) |
|----------|------------|------------------------|
| Family contact | `familyContactName`, `familyContactPhone` | `familyMemberRole` |
| Basic understanding | `projectUnderstanding`, `designStylePreference`, `expectedTimeline` | WFH Setup, Pet Friendly |
| Internal notes | `internalExecutiveNotes`, `salesRiskNotes`, `designHandoffNotes` | Closure Probability |
| Reuse lead row | `bookingType`, `configuration` (BHK), `budget`, `altPhoneNumber` | — |

---

## UI → Hub JSON mapping

### Lead detail V2 — Family Contact card

| UI | Hub key | Storage |
|----|---------|---------|
| Name | `familyContactName` | `configuration_scope.family_contact_name` |
| Phone | `familyContactPhone` | `configuration_scope.family_contact_phone` (mirror lead `altPhoneNumber` in UI) |
| Role (Spouse) | — | **Frontend state only** |

### Configuration Scope §1 — Basic Understanding

| UI | Hub key | Notes |
|----|---------|-------|
| Property Name / Site + Family Size | `projectUnderstanding` | Max 2000 chars; UI may combine two inputs into one string |
| Timeline (45 / 90 days) | `expectedTimeline` | Max 200 chars; e.g. `90 Days (Standard)` |
| Design style (if shown) | `designStylePreference` | Max 200 chars |
| BHK Type | — | Display lead `configuration` |
| Type | `bookingType` | On lead row; sent via requirements PUT |
| WFH Setup | — | Frontend-only |
| Pet Friendly | — | Frontend-only |

### Configuration Scope §5 — Internal Executive Notes

| UI | Hub key | Notes |
|----|---------|-------|
| Personality Type | `designStylePreference` | Or separate UI field mapped to this key |
| Competition | `salesRiskNotes` | Max 2000 chars |
| Executive Summary for Designer | `designHandoffNotes` | Max 2000 chars |
| (optional extra) | `internalExecutiveNotes` | Max 4000 chars |
| Closure Probability | — | Frontend-only |

### §4 Financial Guardrails

| UI | Source |
|----|--------|
| Investment range | Lead `budget` |
| Luxury slider | Computed in frontend from `budget` |

---

## PUT body (all scope fields)

Send on every requirements PUT (full replace for rooms; include §1/§5 keys):

```json
{
  "version": 1,
  "availableRoomCatalog": [],
  "selectedRooms": [],
  "miscAddOns": [],
  "kitchenLayout": null,
  "materialFinish": null,
  "familyContactName": null,
  "familyContactPhone": null,
  "bookingType": "APARTMENT",
  "projectUnderstanding": null,
  "designStylePreference": null,
  "expectedTimeline": null,
  "internalExecutiveNotes": null,
  "salesRiskNotes": null,
  "designHandoffNotes": null
}
```

---

## Frontend-only fields (do not send to Hub)

| Field | Reason |
|-------|--------|
| `familyMemberRole` | No Hub column |
| `wfhSetup` | Product decision |
| `petFriendly` | Product decision |
| `closureProbability` | Product decision |

---

## Frontend client

`lib/configuration-scope-client.ts` — `ConfigurationScopeRequirements` type includes all Hub keys above; `toPutRequirementsBody()` sends them on save.

---

## QA checklist (§1 + §5)

- [ ] GET requirements returns all §1/§5 keys (null on first load)
- [ ] PUT persists `familyContactName`, `familyContactPhone`
- [ ] PUT persists `projectUnderstanding`, `expectedTimeline`, `designStylePreference`
- [ ] PUT persists `salesRiskNotes`, `designHandoffNotes`, `internalExecutiveNotes`
- [ ] `bookingType` on PUT updates lead row
- [ ] 409 on stale `version`
- [ ] Frontend-only fields not required by Hub validation

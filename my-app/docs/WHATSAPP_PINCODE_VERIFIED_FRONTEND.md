# WhatsApp Lead — Pincode Auto-Verify (Frontend)

**Status:** Implemented in CRM UI  
**Hub contract:** dual path on create/inbound by `propertyPin`  
**Related:** integration guide from Hub team; this file is the Next.js CRM notes.

---

## Product rules (Hub — do not re-implement)

| Inbound / create | `verified` | Assignee | UI bucket |
|------------------|------------|----------|-----------|
| **Pincode present** | `true` / `VERIFIED` | Sales (pincode RR) | Verified / Sales |
| **Pincode missing** | `false` / `UNVERIFIED` | Presales 50-50 | Unverified / Presales |

Manual verify is **unchanged**: `POST /v1/WhatsappLead/verify/{id}` with **required** pincode — only for still-unverified leads.

---

## What the CRM frontend does

### Lists (`GET /v1/leads/filter?leadType=whatsapplead`)

- **Presales workspace:** default `verificationStatus=unverified` (no-pin path).
- **Sales workspace:** default `verificationStatus=verified` (includes pin auto-verified).
- **Admin / Sales Admin / Super Admin on WhatsApp tile:** empty default → both buckets.
- Never hardcode “all WhatsApp = unverified”.

Code: `defaultVerificationForLeadTypeFilter` in `lib/crm-workspace.ts`.

### Row badges / journey

- List maps Hub `verified` / `verificationStatus` → Verified / Unverified tags.
- WhatsApp pipeline badge/journey follows **verified** (not only workspace tab) so mixed admin filters stay correct.

Code: `mapApiLeadToRow` (`lib/leads-filter.ts`), `usePresalesListDisplayForWorkspace` (`lib/presales-milestone.ts`), `LeadsTable.tsx`.

### Detail

- Header: **Verified** / **Unverified** chip.
- Stats row: Property Pincode (or `—`).
- **Verify** CTA only when `!isCrmLeadVerified(lead)` (and role/assignee rules).
- Pin auto-verified leads open as **sales** pipeline (`isLeadHandedOffToSales`).

### Helpers

`lib/crm-whatsapp-leads.ts`:

- `shouldShowWhatsappVerifyCta`
- `resolveWhatsappPropertyPin`
- `describeWhatsappCreateOutcome` — toasts for create/inbound-style JSON with `verified` + `assignee` + pin

### BFF (unchanged contracts)

| Action | Path |
|--------|------|
| List | `GET /api/crm/leads?leadType=whatsapplead&verificationStatus=…` |
| Details | `GET\|PUT /api/crm/whatsapp-leads/{id}/details` |
| Verify | `POST /api/crm/whatsapp-leads/{id}/verify` |
| Inbound (server) | `POST /api/crm/whatsapp-leads/inbound` — **not** from browser |

---

## QA (frontend)

| # | Scenario | Expect |
|---|----------|--------|
| 1 | New WA with pin | Verified tab / sales; pin chip; **no** Verify |
| 2 | New WA without pin | Unverified / presales; Verify works with pin |
| 3 | Unverified → verify | Moves to verified; sales assignee |
| 4 | Open auto-verified detail | Verified badge + pin; sales pipeline |
| 5 | Admin WhatsApp tile | Both verified and unverified rows when no VS filter |

---

## Do not

- Call MSG91 webhook from the browser.
- Force all WhatsApp lists to `unverified`.
- Allow Verify when already `verified` / `VERIFIED`.
- Treat create responses as always `verified: false`.

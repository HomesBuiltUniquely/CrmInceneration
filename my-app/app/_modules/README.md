# Module layout (CRM / Hows frontend)

This folder is a **private** App Router segment (`_modules` is not part of any URL). Use it for **docs and future colocated code** so features stay grouped by **business module** and **role**, without mixing route files.

## Where things live today

| Module | Who uses it (roles) | UI (`app/Components/…`) | Path alias (new imports) |
|--------|---------------------|---------------------------|----------------------------|
| **Shell** | All authenticated users | `Shared/` | `@shell/*` |
| **CRM — lead management** | Super Admin, Admin, Sales, Presales | `CrmLeadData/` | `@crm/lead-management/*` |
| **CRM — dashboard** | Super Admin (main dashboard), others via nav | `CrmDashboard/` | `@crm/dashboard/*` |
| **CRM — lead detail** | Same as lead list + design handoff | `CrmLeadDetails/` | `@crm/lead-details/*` |
| **CRM — create lead** | Allowed create roles | `CrmCreateLead/` | `@crm/create-lead/*` |
| **CRM — import** | Sales Admin / Manager (per filters) | `CrmImportLeads/` | `@crm/import-leads/*` |
| **Design** | Designer, Design Manager, TDM | `DesignDashboard/` | `@design/workspace/*` |
| **Design — appointments** | Design roles | `Appointment/` | `@design/appointment/*` |
| **Admin** | Super Admin, Sales Admin, Presales Manager (subset) | `AdminPanel/` | `@admin/panel/*` |
| **Calendar** | Most CRM roles (not all presales) | `HubCalender/` | `@calendar/hub/*` |
| **Booking & Token** | Super Admin only (sidebar below Design) | `BookingToken/` | `@booking-token/*` |
| **App core** | Cross-cutting (auth gate, etc.) | `RequireAuth.tsx`, `LogoutButton.tsx` | `@app-core/*` |

## Libraries

| Concern | Location | Notes |
|---------|----------|--------|
| **Roles & presales visibility** | `lib/roles/` (barrel) + `lib/crm-role-access.ts`, `lib/presales-lead-visibility.ts` | New code: `import { … } from "@/lib/roles"` |
| **Auth / tokens** | `lib/auth/` | `api.ts`, client helpers |
| **CRM API proxies** | `app/api/crm/` | BFF routes |
| **Presales month / heatmap math** | `lib/presales-heatmap-helpers.ts` | Shared by heatmap + API |

## Routes → module (for bugs / features)

| Route | Module |
|-------|--------|
| `/Leads`, `/presales-leads` | CRM lead management |
| `/super-admin` (dashboard shell) | CRM dashboard |
| `/create-lead`, `/import-leads` | CRM wizards |
| `/admin-panel` | Admin |
| `/design-dashboard`, `/appointment` | Design |
| `/google-calendar` | Calendar |
| `/booking-token` | Booking & Token |

## Conventions for new work

1. **Prefer path aliases** from `tsconfig.json` (`@crm/lead-management/Header` instead of long `../../` chains).
2. **Put role rules in `lib/roles`** (or next to the feature in `lib/` and export through `lib/roles/index.ts` when it is role-specific).
3. **When a folder grows**, move the whole feature directory under the matching `app/Components/<Module>/` name (or split into `app/_modules/<module>/…` only if you add a `layout.tsx`/`page.tsx` there intentionally—usually keep routable pages under `app/<route>/`).

## Migration (optional)

Moving `CrmLeadData` → `_modules/crm/lead-data` is possible later; update all imports to `@crm/lead-management/*` first, then physically move the folder and point the alias to the new path.

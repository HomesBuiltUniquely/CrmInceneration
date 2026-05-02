# Sales Closure URL prefill (CRM → Hub)

When the CRM opens `https://design.hubinterior.com/SalesClosure`, it appends query parameters so the **Sales Closure Submission Form** can auto-fill fields.

The Hub app should read these on initial load (same names as below). All values are URL-encoded strings.

## Always sent (existing)

| Query param | Description |
|-------------|-------------|
| `leadId` | Business lead id from CRM |
| `leadType` | e.g. `Add Lead`, `G Lead`, … |
| `returnUrl` | CRM page to return to after completion |

## Lead-based prefill (from CRM lead detail)

| Query param | CRM source | Suggested Hub field |
|-------------|------------|---------------------|
| `customerName` | Lead customer name | Customer Name |
| `clientEmail` | Lead email | Email |
| `contactNo` | Lead phone | Contact No. |
| `leadSource` | Lead source | Lead Source |
| `propertyName` | **Property notes** (`propertyNotes` / `property_detail`) | Property Name |
| `propertyConfiguration` | **Configuration** (BHK / unit; Add Lead uses `propertyType` on API) | Property Configuration (dropdown can match on label/value) |

Long text may be truncated (~1800 chars) for URL safety.

## Auth user prefill (`GET /api/auth/me` — logged-in sales user)

| Query param | Typical backend user fields | Suggested Hub field |
|-------------|------------------------------|---------------------|
| `salesMail` | `email`, `mail`, `workEmail`, or `username` if it looks like an email | Sales Mail Id |
| `experienceCenter` | `experienceCenter`, `branch`, `branchName`, `office`, `territory`, … | Experience Center |

If `experienceCenter` is missing, the Hub can leave the dropdown empty or resolve branch by a separate API using `leadId`.

## Backend responsibility

- Ensure `/api/auth/me` returns **email** and, when available, **branch / experience center** fields so the CRM can pass them through.
- Field names on the user object can vary; the CRM tries several common keys (see `appendSalesClosurePrefillFromAuthUser` in `lib/sales-closure.ts`).

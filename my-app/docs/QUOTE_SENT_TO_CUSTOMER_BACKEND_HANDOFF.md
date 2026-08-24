# Quote Sent (Actually Sent to Customer) — Backend Handoff

**Status:** Hub implemented · Frontend wired to `quoteSentToCustomer`  
**Audience:** Hub / Spring backend (`Project-ERP`) + CRM FE  
**Frontend repo:** `CrmInceneration/my-app`  
**UI:** Leads insight tile **Quote Sent** (Total / Won / Lost), lead list drill-down, Activity History “Quote Sent to Customer ⭐”

> Hub FE handoff (implemented): lead JSON includes `quoteSentToCustomer`, `quoteSentAt`, `quoteSentBy`. Flag set on successful `POST /v1/quote/send` and `POST /api/email/send` when `subStage` is Quote Sent **and** `leadId` + `leadType` are present. Activity: `QUOTE_SENT_TO_CUSTOMER`.

---

## 1. Summary

**Product rule:** A lead counts as **Quote Sent** only when a user has **successfully sent the quote to the customer** (Send Quote / quote email), not when:

- Quote link was only generated / saved (`Get Quote` / `quoteLink` set), or  
- Milestone is only **Meeting Successful**.

| Label (FE tile) | Meaning |
|-----------------|--------|
| **Total** | Leads where quote was actually sent to customer |
| **Lost** | Same + lead is on a lost path |
| **Won** | Total − Lost (sent, still active / not lost) |

**Why Hub is required:** Insight tiles count thousands of leads from list/pool APIs. The CRM frontend cannot load every lead’s activity history to detect send events. A **persisted field on the lead** (returned on list + detail) is required.

Frontend-only workarounds (`localStorage`, guessing from `quoteLink`) are **incorrect** across users/devices and for historical data.

---

## 2. Database (recommended)

Persist on each CRM lead source table (or shared lead extension used by Hub list APIs).

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `quote_sent_to_customer` | `BOOLEAN` | NOT NULL, default `false` | True after successful customer quote send |
| `quote_sent_at` | `TIMESTAMPTZ` | NULL | First successful send time (UTC) |
| `quote_sent_by` | `VARCHAR` / user id | NULL | Optional: who clicked Send Quote |

**Optional index** (insight / reporting):

```sql
CREATE INDEX idx_lead_quote_sent_at
  ON <lead_table> (quote_sent_to_customer, quote_sent_at DESC)
  WHERE quote_sent_to_customer = true;
```

Apply the same columns (or equivalent JSON fields) for all lead types Hub merges into the sales pool (`formlead`, `glead`, `mlead`, etc.).

---

## 3. When to set the flag

### Trigger A — CRM “Send Quote” (primary)

Today CRM calls Hub email / quote send with substage context **Quote Sent** (e.g. `POST /api/email/send` via frontend BFF, and/or `POST /v1/quote/send`).

**On successful send only:**

1. Set `quote_sent_to_customer = true`  
2. Set `quote_sent_at = now()` if previously null (keep first send; or update “last sent” if product wants last — prefer **first** for counting)  
3. Optionally set `quote_sent_by`  
4. Append activity (already often created), e.g. quote link / quote email sent  
5. **Do not** require changing milestone solely for the tile — flag is source of truth for counts

### Trigger B — Any other Hub path that emails the customer quote

If Design Module / Hub admin also sends the customer quote email, set the **same** fields so CRM tiles stay accurate.

### Do **not** set the flag when

| Action | Reason |
|--------|--------|
| Get Quote / resolve quote URL | Link only |
| `PUT` lead with `quoteLink` only | Save link ≠ send to customer |
| Meeting Successful (Complete Task) | Meeting done ≠ quote emailed |
| Quote Pending substages | Belongs in **Quote Due**, not Quote Sent |

---

## 4. API — return fields on list + detail

Every lead payload used by CRM sales insight / heatmap / assignee pool / detail must include:

| JSON field (camelCase) | Type | Notes |
|------------------------|------|--------|
| `quoteSentToCustomer` | boolean | Required for FE tile |
| `quoteSentAt` | string \| null | ISO-8601 preferred |
| `quoteSentBy` | string \| null | Optional |

**Aliases FE can also accept (if you already use them):**

- `quoteEmailSent`, `quoteSent`, `isQuoteSentToCustomer`  
- `quoteSentAt`, `quoteEmailedAt`

**Example (list item / detail fragment):**

```json
{
  "id": "71164",
  "quoteLink": "https://design.hubinterior.com/quote/71164",
  "quoteSentToCustomer": true,
  "quoteSentAt": "2026-07-15T16:31:37.000Z",
  "quoteSentBy": "Somashekr_V",
  "stage": {
    "milestoneStage": "Experience & Design",
    "milestoneStageCategory": "…",
    "milestoneSubStage": "Meeting Successful"
  }
}
```

Even if substage is still “Meeting Successful”, **`quoteSentToCustomer: true`** means the lead is in Quote Sent for CRM.

---

## 5. Optional: set milestone substage “Quote Sent”

Product may also move substage to **Quote Sent** after email success. That is fine for pipeline UI, but:

- **Tile source of truth** must remain `quoteSentToCustomer` (boolean), not “substage contains Meeting Successful” or “has quoteLink”.
- Avoid counting Meeting Successful alone as Quote Sent.

---

## 6. Backfill old sales leads from Activity History (recommended)

**Product rule:** For old rows where `quote_sent_to_customer = false`, if **Activity History** shows a real quote-sent event, set the flag — **only for leads currently in Sales** (sales pool / sales assignees). Do not backfill every historical CRM row blindly.

### Why Hub (not CRM frontend)

Leads insight tiles count from **list/pool APIs**. Those payloads usually **do not include** full activity history. The CRM UI cannot call `GET …/activities/{id}` for ~2,000 sales leads without killing performance.

So: **one-time Hub SQL / job** (or Hub batch API) must set the flag from activity. CRM then keeps reading `quoteSentToCustomer`.

### What counts as “quote sent” in activity

Prefer (newest → oldest):

1. `activityType = 'QUOTE_SENT_TO_CUSTOMER'`
2. Description starts with / contains **`Quote Sent to Customer`**
3. Legacy (only if product confirms this activity was created on **Send Quote**, not Get Quote):  
   `Quote link set to: https://…`

Do **not** backfill from Meeting Successful alone.

### Scope: currently in Sales only

Limit the UPDATE to leads that are still in the **sales** dataset Hub uses for CRM sales insight (same pool as assignee / sales workspace), e.g.:

- Lead has a sales assignee / is in sales admin pool tables Hub merges for CRM, **and/or**
- Milestone is sales pipeline (Discovery → Closed) as used by CRM sales workspace  

Exclude pure presales-only rows if they are not in that sales pool.

### Pseudocode SQL (adjust table names)

```sql
-- Example pattern — map to Hub activity + lead tables per lead type
UPDATE <sales_lead_table> l
SET
  quote_sent_to_customer = true,
  quote_sent_at = COALESCE(l.quote_sent_at, a.first_sent_at),
  quote_sent_by = COALESCE(l.quote_sent_by, a.first_sent_by)
FROM (
  SELECT
    lead_id,
    MIN(created_at) AS first_sent_at,
    MIN(performed_by) AS first_sent_by  -- or FIRST_VALUE if preferred
  FROM <lead_activity_table>
  WHERE
    UPPER(REPLACE(activity_type, ' ', '_')) = 'QUOTE_SENT_TO_CUSTOMER'
    OR description ILIKE 'Quote Sent to Customer%'
    -- OR description ILIKE 'Quote link set%'  -- only if send-only historically
  GROUP BY lead_id
) a
WHERE a.lead_id = l.id
  AND COALESCE(l.quote_sent_to_customer, false) = false
  -- AND <sales-pool predicate>  -- required: only current sales leads
;
```

Repeat per lead-source table (form / g / m / add / website / whatsapp / walk-in) or run via Hub’s unified lead id map.

### After backfill

- CRM Quote Sent tile Total / Won / Lost will include old sales sends.  
- New sends continue to set the flag on `POST /v1/quote/send` and `POST /api/email/send`.

### Optional FE fallback

CRM `isQuoteSentLead` also treats embedded `activities[]` on a lead row as Quote Sent (same activity rules). Useful if Hub later embeds a short activity snippet on list rows. **Not a substitute for Hub backfill** while list APIs omit activities.

---

## 7. Frontend tile rule (current)

File: `lib/lead-milestone-insight-tiles.ts` → `isQuoteSentLead`

```ts
export function isQuoteSentLead(lead: ApiLead): boolean {
  if (isQuotePendingSubStage(lead)) return false;
  // 1) Hub flag
  if (lead.quoteSentToCustomer === true || lead.quoteEmailSent === true) return true;
  if (String(lead.quoteSentAt ?? "").trim()) return true;
  // 2) Embedded activities (old-data fallback when present on the row)
  //    QUOTE_SENT_TO_CUSTOMER / "Quote Sent to Customer"
  // 3) No Meeting Successful / quoteLink-only
  return /* activity check */ false;
}
```

Won / Lost: Lost = sent + lost path; Won = Total − Lost. Counting runs only on the **sales insight pool**.

---

## 8. Acceptance checklist

- [ ] Run `quote_sent_to_customer_migration.sql` on Hub DB  
- [ ] Run **sales-only activity backfill** (section 6) for old data  
- [ ] Send Quote always sends `leadId` + `leadType` on `/v1/quote/send`  
- [ ] `/api/email/send` Quote Sent includes `leadType` + numeric `leadId`  
- [ ] Insight tiles use `quoteSentToCustomer` (not Meeting Successful / quoteLink)  
- [ ] GET detail after send shows `quoteSentToCustomer: true`  
- [ ] Old sales lead with Quote Sent activity (and backfilled flag) appears on Quote Sent tile  

---

## 9. Contact / mapping notes

| CRM UI | Hub responsibility |
|--------|-------------------|
| Send Quote button | Persist flag on successful email/quote send |
| Quote Sent tile | Read `quoteSentToCustomer` / `quoteSentAt` from sales pool |
| Old data | Backfill flag from activity for **current sales** leads only |
| Quote Due tile | Unchanged: quote pending substages (not sent) |

**Frontend contact point:** `CrmInceneration/my-app` — `lib/lead-milestone-insight-tiles.ts`, `app/Components/CrmLeadData/LeadsToolbar.tsx`, Send Quote in `LeadDetailsApiClient.tsx`.

---

## 10. Insights KPI — quotes sent this month (filter by send date)

CRM Insights card **Quotes Sent** must count leads whose **quote was sent in the selected month**, even if the lead was created earlier.

**Do not** filter this KPI on `created_at` / enquiry date.

### Lead fields Hub must persist (list + detail)

| JSON field | Type | Rule |
|---|---|---|
| `quoteSentToCustomer` | boolean | True after a successful customer send |
| `quoteSentAt` | string (ISO) \| null | **First** successful send |
| `lastQuoteSentAt` | string (ISO) \| null | **Latest** send (use this for the month window when present) |
| `quoteSentCount` | number | Optional |
| Quotation value | number | Current quote Total Investment (same source as quote-sent value elsewhere) |

### New Hub API

`GET /v1/crm/insights/quotes-sent-month`

Same scope query params as performance-cards (`dateFrom`, `dateTo`, `dateRange=current_month`, `branchId`, `salesManagerId`, `salesExecutiveId`).

**Window:** `lastQuoteSentAt` if set, else `quoteSentAt`, must fall in `[dateFrom, dateTo]` (calendar month when `dateRange=current_month`).

**Example response:**

```json
{
  "success": true,
  "hubImplemented": true,
  "filterField": "quoteSentAt",
  "periodStart": "2026-08-01T00:00:00.000Z",
  "periodEnd": "2026-08-31T23:59:59.999Z",
  "quotesSentCount": 15,
  "quotationValueInr": 5200000
}
```

| Property | Meaning |
|---|---|
| `quotesSentCount` | Distinct sales leads with a quote **sent in this window** |
| `quotationValueInr` | Sum of those leads’ current quotation value (INR) |

CRM BFF: `GET /api/crm/insights/quotes-sent-month` (proxies Hub). Until Hub ships this, CRM computes the same KPI from the sales pool using `quoteSentAt`.


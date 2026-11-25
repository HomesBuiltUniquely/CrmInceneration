# Hub handoff — Sales Executive follow-up day brief (phase 2)

**Audience:** Hub / backend team  
**CRM consumer:** `GET /api/crm/sales-executive/follow-up-day` (Next BFF v1)  
**Goal:** Replace full `mergeAll` with a single indexed query and optional server-side snapshot storage.

## Proposed Hub endpoint

`GET /v1/crm/sales-executive/follow-up-day`

**Auth:** Same JWT as `/v1/leads/filter` (scopes to assignee).  
**Query:** `variant=morning|evening`, `timezone` (IANA), optional `snapshotId` for evening.

**Response:** Same JSON schema as BFF v1 (see `app/api/crm/sales-executive/follow-up-day/route.ts`).

## Data rules (match CRM)

- **Due today:** `follow_up_date` in assignee’s local calendar day (use `effective` follow-up rules: stored date, else enquiry+2h; exclude LOST segment).
- **Lead vs opportunity:** Discovery/Connection = active; Experience & Design → Closed = closure.
- **Overdue:** follow-up strictly before today’s local midnight.
- **Evening completed:** morning snapshot item no longer due today after task/reschedule.

## Suggested SQL / indexes

- Index: `(sales_executive_id, follow_up_date)` or assignee id + `follow_up_date`.
- Filter: `assignee_id = :viewer`, `verification_status` sales-verified inbox rules, milestone scope CRM.
- Return: counts + top 5 (morning) / top 8 pending (evening) with customer name, milestone substage, time.

## Snapshot table (optional)

```text
se_followup_day_snapshot (
  user_id BIGINT,
  local_date DATE,
  items_json JSONB,
  captured_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, local_date)
)
```

Evening compares stored items to current rows; BFF v1 uses signed token instead until this exists.

## BFF cutover

1. Implement Hub endpoint behind feature flag.
2. BFF tries Hub first; on 404 falls back to v1 merge pipeline (`crm-leads-pool-server.ts`).
3. Remove `size=50000` merge once Hub P95 &lt; 500ms in prod.
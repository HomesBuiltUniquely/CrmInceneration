# Sales Executive Monthly Revenue Targets — Backend Handoff

## Summary

Each **sales executive** has a **monthly revenue target** for incentives (default **₹60,00,000 / 60 lakhs**).

**Sales Admin** and **Super Admin** set:
- Org default target for new executives
- Per-executive override per calendar month (`YYYY-MM`)

Frontend:
- **Admin Panel → Revenue Targets** (`/admin-panel`, section `#salesTarget`)
- **Incentives page** (`/incentives`) reads targets for the selected month

BFF proxy: `GET|POST /api/sales-targets/*` → `{BASE_URL}/v1/sales-targets/*`

---

## Data model (suggested)

Table: `sales_executive_monthly_target`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | BIGINT | Sales executive user id |
| `target_month` | CHAR(7) | `YYYY-MM` |
| `monthly_target_inr` | BIGINT | INR paise or whole rupees (use whole rupees: `6000000`) |
| `set_by_user_id` | BIGINT | Admin who last updated |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

Unique: `(user_id, target_month)`

Table: `sales_target_default`

| Column | Type | Notes |
|--------|------|-------|
| `target_month` | CHAR(7) | PK — default for that month |
| `default_target_inr` | BIGINT | Default when no per-user row |
| `updated_at` | TIMESTAMP | |

Seed: `default_target_inr = 6000000` for all months until admin changes.

---

## API

Base: `/v1/sales-targets`

Auth: JWT — **SUPER_ADMIN**, **SALES_ADMIN** for writes; **SALES_EXECUTIVE** / **SALES_MANAGER** read own or team as per roster rules.

### GET `/default?month=2026-06`

```json
{
  "month": "2026-06",
  "defaultTargetInr": 6000000
}
```

### POST `/default`

```json
{
  "month": "2026-06",
  "defaultTargetInr": 6000000
}
```

### GET `/users?month=2026-06`

Returns all **active sales executives** with resolved target (override or default).

```json
[
  {
    "userId": 42,
    "name": "Rahul Kulkarni",
    "role": "SALES_EXECUTIVE",
    "branch": "HBR",
    "managerName": "Priya Menon",
    "monthlyTargetInr": 6000000,
    "isCustom": false
  },
  {
    "userId": 57,
    "name": "Neha Desai",
    "monthlyTargetInr": 7500000,
    "isCustom": true
  }
]
```

### POST `/user/{userId}`

```json
{
  "month": "2026-06",
  "monthlyTargetInr": 7500000
}
```

### POST `/bulk/users`

```json
{
  "month": "2026-06",
  "userIds": [42, 57, 61],
  "monthlyTargetInr": 8000000
}
```

---

## Frontend integration

| File | Role |
|------|------|
| `lib/sales-targets.ts` | Default constant, month helpers, formatting |
| `lib/sales-targets-api.ts` | Client API + `applyMonthlyTargets()` |
| `app/api/sales-targets/[...path]/route.ts` | BFF proxy |
| `app/Components/AdminPanel/SalesTargetSection.tsx` | Admin UI |
| `lib/incentives-profile.ts` | Uses `member.monthlyTargetInr ?? 6000000` |
| `app/Components/Incentives/IncentivesClient.tsx` | Month picker + target merge |

---

## Behaviour

1. New executive with no row → **₹60L** for that month.
2. Admin changes default for June → applies to all execs without custom row for June.
3. Admin sets custom target for one exec → only that exec for that month.
4. Incentives **Total Target** card shows admin-set value (not full deal value).
5. Achievement % = closed revenue / `monthlyTargetInr` (achievement wiring is separate — still mock until closure API connected).

---

## Checklist

- [ ] Create tables + default seed 60L
- [ ] Implement GET/POST default, users, user, bulk
- [ ] Restrict writes to SUPER_ADMIN + SALES_ADMIN
- [ ] Return `isCustom: true` when per-user row exists
- [ ] Verify BFF proxy from CRM app

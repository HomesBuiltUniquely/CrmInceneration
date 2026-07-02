# Incentives — Weighted Revenue Calculation

## Source data

Each **booking-done** lead contributes to incentives based on:

- **Quotation value (QV)** — selected quote amount
- **Amount received** — cumulative payment from booking-done / token payments

Data comes from `booking_token_record` via `GET /api/crm/booking-token/deals` (Booking & Token dashboard).

Leads are scoped to the selected **month** (`submittedAt`) and assigned to the sales executive via `submittedByUserId` or `submittedByName`.

---

## Weighted value rules

| Payment received | Weighted value |
|------------------|----------------|
| **≥ 10% of QV** | **100% of QV** (full quotation) |
| **< 10%** and (**≥ 5% of QV** OR **≥ ₹25,000**) | **50% of QV** (half) |
| **< 5% of QV** and **< ₹25,000** | **₹0** (not eligible) |

### Examples (QV = ₹10,00,000)

| Received | Rule | Weighted |
|----------|------|----------|
| ₹1,00,000 (10%) | Full 10% paid | ₹10,00,000 |
| ₹60,000 (6%) | Token ≥ 5% | ₹5,00,000 |
| ₹30,000 | Token ≥ ₹25k | ₹5,00,000 |
| ₹20,000 | Below both thresholds | ₹0 |

---

## Achievement & slabs

- **Weighted revenue** = sum of weighted values for all booking-done leads in the month
- **Achievement %** = weighted revenue ÷ monthly target (default ₹60L) × 100
- **Slab thresholds** = 40%, 50%, 60%, 80%, 100% of monthly target (weighted revenue must reach these levels)
- **Incentive earned** = **monthly target × slab rate** (not weighted revenue × rate)

| Achievement (weighted ÷ target) | Slab rate | Incentive on ₹60L target |
|--------------------------------|-----------|--------------------------|
| ≥ 40% | 0.20% | ₹12,000 |
| ≥ 50% | 0.30% | ₹18,000 |
| ≥ 60% | 0.45% | ₹27,000 |
| ≥ 80% | 0.60% | ₹36,000 |
| ≥ 100% | 0.80% | ₹48,000 |

Below **40%** achievement → **₹0** incentive.

Per-lead ledger incentive = total incentive × (lead weighted ÷ total weighted).

---

## Frontend files

| File | Purpose |
|------|---------|
| `lib/incentives-weighted.ts` | Weight calculation |
| `lib/incentives-booking-data.ts` | Fetch & filter booking leads |
| `lib/incentives-profile.ts` | Build profile, ledger, slabs |
| `app/Components/Incentives/IncentiveDashboard.tsx` | Weighted column in ledger |

---

## Ledger columns

| Column | Description |
|--------|-------------|
| Quote Value | Full quotation amount |
| Received | Payment received so far |
| **Weighted** | Counted revenue per rules above |
| Status | Full / Half / Not eligible |
| Incentive | Weighted × slab rate |

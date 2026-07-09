# Incentives — Weighted Revenue Calculation

## Source data

Each **booking-done** lead contributes to incentives based on:

- **Quotation value (QV)** — selected quote amount
- **Amount received** — cumulative payment from booking-done / token payments

Data comes from `booking_token_record` via `GET /api/crm/booking-token/deals` (Booking & Token dashboard).

Leads are scoped to the selected **15-day period** (`submittedAt`: 1st–15th or 16th–end of month) and assigned to the sales executive via `submittedByUserId` or `submittedByName`.

---

## 15-day periods & targets

Each calendar month is split into two incentive periods:

| Period | Days | Target (default) |
|--------|------|------------------|
| **H1** | 1st – 15th | ₹30L |
| **H2** | 16th – end | ₹30L |

Admin monthly target (default ₹60L) is halved per period. Custom monthly targets are split 50/50 (e.g. ₹75L monthly → ₹37.5L per half).

---

## Weighted value rules

| Payment received | Weighted value |
|------------------|----------------|
| **≥ 10% of QV** | **100% of QV** (full quotation) |
| **< 10%** and **≥ ₹25,000** | **50% of QV** (half) |
| **< ₹25,000** | **₹0** (not eligible) |

### Examples (QV = ₹10,00,000)

| Received | Rule | Weighted |
|----------|------|----------|
| ₹1,00,000 (10%) | Full 10% paid | ₹10,00,000 |
| ₹60,000 (6%) | Token ≥ ₹25k | ₹5,00,000 |
| ₹30,000 | Token ≥ ₹25k | ₹5,00,000 |
| ₹20,000 | Below ₹25k | ₹0 |

---

## Achievement & slabs

- **Weighted revenue** = sum of weighted values for booking-done leads in the selected 15-day period
- **Achievement %** = weighted revenue ÷ period target (default ₹30L) × 100
- **Slab thresholds** = 40%, 50%, 60%, 80%, 100% of period target
- **Incentive earned** = **period target × slab rate** (not weighted revenue × rate)

| Achievement (weighted ÷ period target) | Slab rate | Incentive on ₹30L period |
|----------------------------------------|-----------|--------------------------|
| ≥ 40% | 0.20% | ₹6,000 |
| ≥ 50% | 0.30% | ₹9,000 |
| ≥ 60% | 0.45% | ₹13,500 |
| ≥ 80% | 0.60% | ₹18,000 |
| ≥ 100% | 0.80% | ₹24,000 |

Below **40%** weighted achievement → **₹0** incentive (not eligible).

Per-lead ledger shows weighted breakdown only — **no per-lead incentive**. Payout is one amount per 15-day period.

---

## Frontend files

| File | Purpose |
|------|---------|
| `lib/incentive-period.ts` | 15-day period keys, labels, target split |
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

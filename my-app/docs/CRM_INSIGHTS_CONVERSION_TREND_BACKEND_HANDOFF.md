# Insights — Conversion trend + Team Matrix Closed (Hub shipped)

**Status:** Hub deployed deal-based Closed. FE prefers Hub; overlays removed.

## Hub contract (source of truth)

| Field | Rule |
|-------|------|
| `conversionTrend.points[].leadCount` | Leads **created** in W1…Wn |
| `conversionTrend.points[].convertedCount` | Distinct **TOKEN + BOOKING** deals with `submittedAt` in that week |
| Meta | `numeratorRule: "booking_token_closed_in_bucket"`, `bucketField: "deal_submitted_at"` |
| `teamPerformance.closed` | Same deal count (Insights window; not H1/H2) |
| Cross-check | `sum(convertedCount)` = matrix Closed = Booking & Token TOKEN+BOOKING in month |

## FE checklist (done)

- [x] Closed → Hub `teamPerformance.closed` (no `max(hub, booking)`)
- [x] Conv → Hub `conversionPercent` (fallback `closed ÷ leads`)
- [x] Conversion trend → Hub when `points` non-empty (no FE deal rebuild for chart)
- [x] Achieved ₹ stays on Incentives H1+H2
- [x] No 15/15 on Proposals / Closed / Conv

FE volume charts still rebuild **Leads over time** from the sales pool; conversion line uses Hub.

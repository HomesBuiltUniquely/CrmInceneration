# Insights — Closed new vs old (FE)

**Status:** Wired. Hub is source of truth; FE does not rebuild from Booking & Token.

## Surfaces

| UI | Source |
|----|--------|
| Conversion card month strip (New / Old / Total) | `dashboard.closedBreakdown` or `GET /closed-new-old` |
| Primary week line % | Hub `conversionTrend.points[].conversionPercent` (= new ÷ created) |
| Dot popover | `convertedNewCount` / `convertedOldCount` / `convertedCount` / cohort fields |
| Matrix Closed hover | `closedNew` · `closedOld` · total |

## BFF

`GET /api/crm/insights/closed-new-old` → Hub `/v1/crm/insights/closed-new-old`

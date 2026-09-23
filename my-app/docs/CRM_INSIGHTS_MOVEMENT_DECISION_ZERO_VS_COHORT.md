# Movement Decision = 0 vs New batch Decision > 0

## Verdict

**Both numbers can be correct.** They answer different questions. This is **not** an FE display bug — FE paints Hub `stages[].count` / `newCount` / `oldCount` for `stageKey: "decision"` as-is.

| Mode | API | Decision meaning |
|------|-----|------------------|
| **Movement** | `funnelMode=passages` | Count of **Decision checkpoint entries** in `lead_stage_transition` with `exitedAt` in the Insights window |
| **New batch** | `funnelMode=cohort` | Of leads **created** in the window, how many have **current** milestone = Decision (or reached Decision) |

## Why Movement Decision = 0 while Closed = 22 and New batch Decision = 10

Root cause (Hub, Sep 2026): `checkpointOf` collapsed Decision → `Meeting Successful`. Entering Decision often wrote **no new row** (same checkpoint as Exp & Design). Passages never saw `stageKey: "decision"`. Closed Won still wrote Closed rows → **Closed > 0, Decision = 0**.

Cohort never needed that row — it reads live milestone → Decision can be 10.

Those “missing” Decision moves often sit inside Movement **Exp & Design** (Meeting Successful / Quote Sent checkpoint).

## FE check (done)

- `buildApiModeFunnelDisplay` does not zero Decision
- `resolveFunnelCanonicalKey("decision")` → `decision` (before Quote Sent / Meeting Successful)
- UI shows Hub `0 new · 0 old` when Hub sends zeros

## Network QA

```http
GET /v1/crm/insights/sales-funnel?dateRange=current_month&funnelMode=passages
GET /v1/crm/insights/sales-funnel?dateRange=current_month&funnelMode=cohort&pathFilter=all
```

Expect passages `decision.count === 0` (until new Decision moves or backfill) and cohort `decision.count === 10` (example).

## Hub ask

1. Confirm deploy of `CP_DECISION` so **new** Decision moves increment Movement Decision.
2. Optional: one-time backfill of Decision rows for leads that entered Decision before the fix (without inventing Decision for Closed-only paths — Closed Won does **not** imply Decision).

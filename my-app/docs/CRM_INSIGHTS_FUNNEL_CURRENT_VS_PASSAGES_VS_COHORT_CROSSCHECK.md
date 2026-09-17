# Sales Funnel — Current vs Passages vs Cohort cross-check (Hub)

**Audience:** Hub / Spring (`CrmInsightsSalesFunnelService` + FE QA)  
**Why:** FE showed Discovery/Total that look “almost same” across modes (44 / 49 / 51 and 53 / 86 / 54). Product expects them to **differ**. Please re-verify Hub math with the same scope so we can confirm data, not UI display bugs.  
**Related:** [`INSIGHTS.md`](./INSIGHTS.md) §7 · [`CRM_INSIGHTS_SALES_FUNNEL_PASSAGES_COHORT_BACKEND_HANDOFF.md`](./CRM_INSIGHTS_SALES_FUNNEL_PASSAGES_COHORT_BACKEND_HANDOFF.md)

---

## 1. Critical clarification — Current is NOT Cohort

| | **Current** | **Cohort** |
|--|-------------|------------|
| **Lead set** | Everyone in scope **right now** (any `createdAt`) | Only leads with **`createdAt` inside** the Insights date filter |
| **Per-stage count** | Lead’s **current milestone** = that stage (sitting now) | Lead has **ever reached** that stage (live reach), even if they already moved past it |
| **Date filter role** | Usually cuts the inventory pool the FE already loaded (same as Journey) | Defines the **cohort denominator** (`createdAt`) |
| **Data owner** | FE journey inventory (aligned with My Leads / heatmap) | Hub `funnelMode=cohort` |

**One-lead examples (same date range = “this month”):**

| Lead | createdAt | Milestone now | **Current Discovery?** | **Cohort Discovery?** | **Passages New Discovery?** |
|------|-----------|---------------|------------------------|-----------------------|-----------------------------|
| A | this month | Discovery | ✅ | ✅ | ✅ if entered Discovery this month |
| B | this month | Connection (was Discovery earlier) | ❌ (sits in Connection) | ✅ (reached Discovery) | ✅ if Discovery entry was this month |
| C | last month | Discovery | ✅ | ❌ (not in cohort) | ❌ for **New** (old); ✅ for **Old** if entered Discovery this month |
| D | this month | Discovery, entered Discovery **last** month | ✅ | ✅ | ❌ for Passages New (entry outside window) |

So:

- **Current Discovery** ≈ “who is in Discovery **now**” (includes old leads still parked there).  
- **Cohort Discovery** ≈ “who was **born** in range and has **touched** Discovery (alive as of now)”.  
- They only match if every Discovery sitter was created in range **and** no cohort lead has left Discovery yet — rare.

**Passages → New Discovery** ≈ “**entry events** into Discovery in the date window where lead `createdAt` is also in range” — throughput, not inventory, not reach.

---

## 2. Observed FE numbers to cross-check (same UI filters)

Capture and use the **exact** Insights header filters when replaying (branch, SM/SE, date preset). Example observation from Super Admin preview:

| Mode | UI control | Discovery | Total | Source |
|------|------------|-----------|-------|--------|
| **Current** | All path | **44** | **53** | FE journey inventory |
| **Passages** | Age = **New** | **49** | **86** (combined Total bar — see §4) | Hub `newCount` on Discovery; Total uses combined `count` |
| **Cohort** | path ≈ All / new cohort | **51** | **54** | Hub reach counts |

**Do not treat 44 ≈ 49 ≈ 51 as a bug by itself.** Please prove each number with lead-id lists (§5).

---

## 3. Expected inequality rules (acceptance)

For the **same** `branchId` / people scope / date range:

1. **Current Discovery** can be **&lt; or &gt;** Cohort Discovery  
   - Lower when cohort leads already left Discovery (still count in Cohort reach).  
   - Higher when many **old** leads still sit in Discovery (Current includes them; Cohort does not).

2. **Passages New Discovery** can be **≠** Cohort Discovery  
   - Cohort higher when leads created in range entered Discovery **before** the filter window.  
   - Passages New higher when a lead entered Discovery **multiple times** in-window (if Hub counts events not distinct leads — confirm).

3. **Passages Total (combined)** is **not** comparable to Current Total or Cohort Total  
   - Passages Total = stage-entry throughput (often unique entries / summed events per Hub definition).  
   - Current Total = inventory headcount.  
   - Cohort Total = created-in-range headcount.

4. **Closed** = Closed Won checkpoint only (product decision already shipped).

Timezone for all bounds: **`Asia/Kolkata`**.

---

## 4. API replay (Hub)

```http
# Passages (FE does not send pathFilter)
GET /v1/crm/insights/sales-funnel
  ?dateRange=<same as UI>
  &dateFrom=&dateTo=
  &branchId=
  &salesManagerId=
  &salesExecutiveId=
  &funnelMode=passages

# Cohort
GET /v1/crm/insights/sales-funnel
  ?dateRange=<same>
  &...scope...
  &funnelMode=cohort
  &pathFilter=all
```

**Passages Discovery New check:** response `stages[discovery].newCount` must equal UI “New” Discovery bar (FE slices client-side; does not re-filter Hub).

**Passages Total:** Hub returns combined Total only (no `newCount`/`oldCount` on Total). FE correctly keeps Total as combined when All/New/Old toggle changes — so **86 with New selected is expected**, not a FE bug. If product wants Total to also slice New/Old, Hub must add `newCount`/`oldCount` on Total (FE can wire after).

**Current:** not from this Hub endpoint — FE uses journey inventory. To cross-check Current Discovery = 44, Hub can still dump “leads currently in Discovery milestone” for same assignee scope and compare id sets to FE.

---

## 5. Lead-id dumps Hub should return for QA (recommended)

For one fixed scope + date range, please export (CSV or temporary debug endpoint) **distinct lead ids**:

| Dump ID | Definition |
|---------|------------|
| `CUR_DISC` | Current milestone = Discovery (same scope as Insights) |
| `CUR_TOTAL` | All leads in Current funnel inventory (Fresh…Closed) |
| `PAS_DISC_NEW` | Distinct leads with ≥1 Discovery **entry** in date window AND `createdAt` in window |
| `PAS_DISC_OLD` | Discovery entry in window AND `createdAt` before window |
| `PAS_DISC_ALL` | `PAS_DISC_NEW ∪ PAS_DISC_OLD` |
| `COH_TOTAL` | `createdAt` in window |
| `COH_DISC` | In `COH_TOTAL` and has **reached** Discovery as of now (ever) |

Then report:

```
|CUR_DISC| = ?
|PAS_DISC_NEW| = ?
|COH_DISC| = ?
|COH_TOTAL| = ?

CUR_DISC − COH_DISC   = old leads sitting in Discovery (expect ≥ 0)
COH_DISC − CUR_DISC   = cohort leads that reached Discovery but are not sitting there now
COH_DISC − PAS_DISC_NEW = created-in-range, reached Discovery, but Discovery entry not in window (or event vs distinct-lead mismatch)
PAS_DISC_NEW − COH_DISC = should be ~0 if Passages counts distinct leads; if >0 investigate double-entry or createAt boundary
```

**Pass / fail:**

- Counts in Hub Passages/Cohort JSON must equal dump sizes.  
- FE Passages New Discovery must equal `PAS_DISC_NEW`.  
- FE Cohort Discovery must equal `COH_DISC`.  
- FE Current Discovery should equal `CUR_DISC` (same scope).  
- Set differences above should be explainable with sample lead ids (3–5 examples each).

---

## 6. Boundary / edge cases to spot-check

1. Lead created **last day of range 23:59 IST** → must be **new** / in cohort.  
2. Lead created **day before range 00:00 IST** → **old** / not in cohort.  
3. Lead created in range, Discovery entry **before** range → in `COH_DISC`, **not** in `PAS_DISC_NEW`.  
4. Lead created before range, enters Discovery **in** range → Current maybe; Passages **Old**; not Cohort.  
5. `dateRange=all` → Passages: all entries classify as **old** (`newCount=0`) per shipped product rule.  
6. Confirm Passages counts **distinct leads per stage** vs **raw transition rows** — document which; FE assumes lead-like counts in UI copy (“Leads”).

---

## 7. What FE already does (so Hub can trust display)

| Mode | FE behavior |
|------|-------------|
| Current | Journey id-merge inventory; date filter on lead list; **not** Hub sales-funnel |
| Passages | Calls Hub `funnelMode=passages`; All/New/Old only slices `count` / `newCount` / `oldCount`; Fresh Lead bar hidden |
| Cohort | Calls Hub `funnelMode=cohort`; shows Hub stage `count` as reach |

If dump sizes match Hub JSON but FE differs → FE bug.  
If dump sizes ≠ Hub JSON → Hub bug.  
If dumps match product definitions but PMs expect equality → product education (this doc §1), not a fix.

---

## 8. Ask back from Hub

Please reply with:

1. `|CUR_DISC|`, `|PAS_DISC_NEW|`, `|COH_DISC|`, `|COH_TOTAL|` for the same filters as the screenshot.  
2. 3 sample lead ids for each set difference in §5.  
3. Confirmation: Passages stage counts are **distinct leads** or **transition events**.  
4. Whether Total should gain `newCount`/`oldCount` for Passages UI.

**Owner (FE):** CrmInceneration Insights Sales Funnel  
**Owner (Hub):** `CrmInsightsSalesFunnelService`

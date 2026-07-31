# Booking & Token — Display Columns (Frontend)

**Status:** Hub API fields documented  
**Audience:** CRM frontend (`CrmInceneration/my-app`) — All / Token / Booking / Cancel tabs, View drawer, payment history  
**Related:** [BOOKING_TOKEN_FRONTEND_DASHBOARD.md](./BOOKING_TOKEN_FRONTEND_DASHBOARD.md), [BOOKING_DATE_BACKEND_HANDOFF.md](./BOOKING_DATE_BACKEND_HANDOFF.md)

---

## 1. Where data comes from

```
GET /api/crm/booking-token/deals
GET /api/crm/lead/{leadType}/{leadId}/booking-done
GET /api/crm/booking-token/deals/{recordId}/payment-history
```

Each deal / record object includes the fields below. **No extra lead API call** is required for designer name — Hub reads it live from the lead row.

---

## 2. Recommended table columns

Use the same columns on **Token**, **Booking**, **Cancel**, and **All** tabs (hide or grey out when not applicable).

| UI column label | API field(s) | When to show |
|-----------------|--------------|--------------|
| **Assign** | `assign` or `assignee` | Always — sales executive on lead |
| **Designer** | `designerName` or `designer_name` | Always — from CRM lead; `—` if empty (e.g. walk-in) |
| **Booking date** | `bookingDate` | Business date user picked on Booking Done (`YYYY-MM-DD`) |
| **Form submitted on** | `createdAt` or `submittedAt` | When user saved Booking Done (format as normal date/time — see §4) |
| **Submitted by** | `submittedByName` | Who opened Booking & Token |
| **Cancelled by** | `cancelledByName` | Cancel tab or `listingType === "cancel"` |
| **Cancellation requested by** | `cancellationRequestedByName` | Optional detail when approval flow used |
| **Approved by** | `cancellationApprovedByName` | Same as `cancellationReviewedByName` — manager / sales admin who approved cancel |
| **Approved on** | `cancellationApprovedAt` | Same as `cancellationReviewedAt` — format as date/time (§4) |
| **Cancelled on** | `cancelledAt` | When deal moved to cancelled |

---

## 3. Field reference (JSON)

### People & lead

```json
{
  "assign": "Rahul Verma",
  "assignee": "Rahul Verma",
  "designerName": "Priya Design",
  "designer_name": "Priya Design",
  "submittedByName": "Rahul Verma",
  "submittedByRole": "SALES_EXECUTIVE"
}
```

### Dates (two meanings)

```json
{
  "bookingDate": "2026-09-05",
  "booking_date": "2026-09-05",
  "createdAt": "2026-09-05T10:30:00+05:30",
  "submittedAt": "2026-09-05T10:30:00+05:30"
}
```

| Field | Meaning |
|-------|---------|
| `bookingDate` | Calendar day chosen in Booking Done modal |
| `createdAt` / `submittedAt` | **When the booking form was submitted** (same instant) |

Do **not** use `bookingDate` for “form filled at”; use `createdAt` for that column.

### Cancellation (approval flow)

```json
{
  "listingType": "cancel",
  "bookingStatus": "cancelled",
  "cancellationApprovalStatus": "NONE",
  "cancellationRequestedByName": "Sales Executive Name",
  "cancellationRequestedAt": "2026-09-06T09:00:00Z",
  "cancellationApprovedByName": "Sales Manager Name",
  "cancellationApprovedAt": "2026-09-06T11:00:00Z",
  "cancellationReviewedByName": "Sales Manager Name",
  "cancellationReviewedAt": "2026-09-06T11:00:00Z",
  "cancelledByName": "Sales Manager Name",
  "cancelledAt": "2026-09-06T11:00:00Z",
  "cancellationReason": "Customer changed plan"
}
```

**How to read it**

| Scenario | Show in UI |
|----------|------------|
| Sales exec **requested** cancel, manager **approved** | **Requested by:** `cancellationRequestedByName` · **Approved by:** `cancellationApprovedByName` · **Approved on:** format `cancellationApprovedAt` · **Cancelled by:** `cancelledByName` (usually approver) |
| Sales admin / super admin **direct** cancel | **Cancelled by:** `cancelledByName` · **Approved by:** same person if present · leave “Requested by” empty |
| Still **pending** approval | `cancellationApprovalStatus === "PENDING"` — show **Requested by** + **Requested on**; hide cancelled-by until approved |

Alias pairs (use either):

- `cancellationApprovedByName` = `cancellationReviewedByName`
- `cancellationApprovedAt` = `cancellationReviewedAt`

---

## 4. Format dates in the UI (normal readable date)

Hub sends ISO-8601 instants for timestamps and `YYYY-MM-DD` for booking date.

### Booking date (date only)

```ts
function formatBookingDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  // Already YYYY-MM-DD from API
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`; // or use Intl / date-fns with Asia/Kolkata
}
```

### Form submitted on (`createdAt` / `submittedAt`)

Show **date + time** in user locale (IST in product):

```ts
function formatFormSubmittedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
// Example: "05 Sep 2026, 10:30 am"
```

### Approved on / Cancelled on

Use the same helper as `formatFormSubmittedAt` on:

- `cancellationApprovedAt`
- `cancelledAt`
- `cancellationRequestedAt` (optional)

---

## 5. Example row (Cancel tab)

| Customer | Assign | Designer | Booking date | Form submitted on | Cancelled by | Approved by | Approved on |
|----------|--------|----------|--------------|-------------------|--------------|-------------|-------------|
| Amit | Rahul | Priya | 05/09/2026 | 05 Sep 2026, 10:30 am | Manager X | Manager X | 06 Sep 2026, 11:00 am |

---

## 6. View drawer / payment history

`GET .../payment-history` top-level block includes the same:

- `assign` / `assignee`
- `designerName`
- `bookingDate`, `createdAt`, `submittedAt`
- cancellation fields via shared shape where deal is cancelled

---

## 7. Frontend checklist

- [x] **Designer** column bound to `designerName`
- [x] **Form submitted on** from `createdAt` (not `bookingDate`)
- [x] **Booking date** from `bookingDate` only
- [x] Cancel tab: **Cancelled by**, **Approved by**, **Approved on**
- [x] Pending cancel: show requester; hide final cancelled-by until approved
- [x] Format all instants with `Asia/Kolkata` (or app locale)
- [x] Empty strings → show `—`

Implementation: `lib/booking-token-display-format.ts`, `bookingTokenDealToDealRow`, `DealsTable.tsx`, `BookingPaymentPanel.tsx`.

---

## 8. Hub note

Designer name is loaded from the linked CRM lead (`designer_name`). Walk-in leads may return `null` — show `—`.

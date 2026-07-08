import type { BookingTokenTab, DealRow } from "@/app/Components/BookingToken/types";
import { fetchBookingTokenDeals, type BookingTokenDeal } from "@/lib/booking-done-api";
import {
  bookingDateFilterApiParams,
  resolveBookingDateRange,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import {
  bookingDealFilterQueryParams,
  type BookingDealFilterState,
  DEFAULT_BOOKING_DEAL_FILTERS,
} from "@/lib/booking-token-deal-filters";
import { listingTypeQueryForTab, resolveListingType } from "@/lib/booking-token-listing-type";
import { bookingTokenDealToDealRow } from "@/lib/booking-token-leads";

export type BookingDashboardFetchOptions = {
  tab: BookingTokenTab;
  dateFilter: BookingDateFilterState;
  dealFilters?: BookingDealFilterState;
  size?: number;
};

/** Enough rows for date-filtered dashboard views (server + client filter). */
export const BOOKING_TOKEN_DASHBOARD_FETCH_SIZE = 500;

export function filterDealRowsByDate(
  rows: DealRow[],
  filter: BookingDateFilterState,
): DealRow[] {
  const range = resolveBookingDateRange(filter);
  if (!range.submittedFrom && !range.submittedTo) return rows;

  const fromMs = range.submittedFrom
    ? new Date(range.submittedFrom).getTime()
    : Number.NEGATIVE_INFINITY;
  const toMs = range.submittedTo
    ? new Date(range.submittedTo).getTime()
    : Number.POSITIVE_INFINITY;

  return rows.filter((row) => {
    const t = new Date(row.submittedAt).getTime();
    return !Number.isNaN(t) && t >= fromMs && t <= toMs;
  });
}

export function filterDealRowsForTab(rows: DealRow[], tab: BookingTokenTab): DealRow[] {
  switch (tab) {
    case "all":
      return rows.filter((row) => row.listingType !== "cancel");
    case "booking":
      return rows.filter((row) => row.listingType === "booking");
    case "token":
      return rows.filter((row) => row.listingType === "token");
    case "cancel":
      return rows.filter((row) => row.listingType === "cancel");
    default:
      return rows;
  }
}

export function filterApiDealsByDate(
  deals: BookingTokenDeal[],
  filter: BookingDateFilterState,
): BookingTokenDeal[] {
  const range = resolveBookingDateRange(filter);
  if (!range.submittedFrom && !range.submittedTo) return deals;

  const fromMs = range.submittedFrom
    ? new Date(range.submittedFrom).getTime()
    : Number.NEGATIVE_INFINITY;
  const toMs = range.submittedTo
    ? new Date(range.submittedTo).getTime()
    : Number.POSITIVE_INFINITY;

  return deals.filter((deal) => {
    const t = new Date(deal.submittedAt).getTime();
    return !Number.isNaN(t) && t >= fromMs && t <= toMs;
  });
}

export function filterApiDealsForTab(
  deals: BookingTokenDeal[],
  tab: BookingTokenTab,
): BookingTokenDeal[] {
  return deals.filter((deal) => {
    const listingType = resolveListingType(deal);
    switch (tab) {
      case "all":
        return listingType !== "cancel";
      case "booking":
        return listingType === "booking";
      case "token":
        return listingType === "token";
      case "cancel":
        return listingType === "cancel";
      default:
        return true;
    }
  });
}

/** Raw Hub deals for ledger / history views. */
export async function fetchDashboardBookingTokenDeals(
  opts: BookingDashboardFetchOptions,
): Promise<BookingTokenDeal[]> {
  const dealFilters = opts.dealFilters ?? DEFAULT_BOOKING_DEAL_FILTERS;
  const response = await fetchBookingTokenDeals({
    page: 0,
    size: opts.size ?? BOOKING_TOKEN_DASHBOARD_FETCH_SIZE,
    listingType: listingTypeQueryForTab(opts.tab),
    ...bookingDateFilterApiParams(opts.dateFilter),
    ...bookingDealFilterQueryParams(dealFilters),
  });

  return filterApiDealsForTab(
    filterApiDealsByDate(response.deals, opts.dateFilter),
    opts.tab,
  );
}

/** Fetch deals for a dashboard tab, applying server params + client safety filter. */
export async function fetchDashboardDealRows(
  opts: BookingDashboardFetchOptions,
): Promise<DealRow[]> {
  const deals = await fetchDashboardBookingTokenDeals(opts);
  return deals.map(bookingTokenDealToDealRow);
}

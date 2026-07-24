import { fetchBookingTokenDeals } from "@/lib/booking-done-api";
import {
  bookingDateFilterApiParams,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import {
  bookingDealFilterQueryParams,
  DEFAULT_BOOKING_DEAL_FILTERS,
  type BookingDealFilterState,
} from "@/lib/booking-token-deal-filters";

export type BookingTokenCancelTabCounts = {
  pendingApproval: number;
  approvedCancel: number;
};

/** Small badges on Cancel tab — pending (red) vs manager-approved (green). */
export async function fetchBookingTokenCancelTabCounts(opts: {
  dateFilter: BookingDateFilterState;
  dealFilters?: BookingDealFilterState;
}): Promise<BookingTokenCancelTabCounts> {
  const dealFilters = opts.dealFilters ?? DEFAULT_BOOKING_DEAL_FILTERS;
  const shared = {
    page: 0,
    size: 1,
    ...bookingDateFilterApiParams(opts.dateFilter),
    ...bookingDealFilterQueryParams(dealFilters),
  };

  try {
    const [pendingRes, approvedRes] = await Promise.all([
      fetchBookingTokenDeals({
        ...shared,
        cancellationStatus: "PENDING",
      }),
      fetchBookingTokenDeals({
        ...shared,
        listingType: "cancel",
        cancellationStatus: "APPROVED",
      }),
    ]);

    return {
      pendingApproval: pendingRes.totalElements ?? 0,
      approvedCancel: approvedRes.totalElements ?? 0,
    };
  } catch {
    return { pendingApproval: 0, approvedCancel: 0 };
  }
}

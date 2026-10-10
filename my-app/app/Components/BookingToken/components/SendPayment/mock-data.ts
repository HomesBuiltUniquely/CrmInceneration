import type { LeadQuoteOption } from "@/lib/crm-quote-links";
import type { PaymentHistoryEntry } from "@/lib/booking-payment-history-api";

/** Storybook / visual mock for Send Payment modal. */
export const sendPaymentMock = {
  customer: "test-quot",
  quoteId: "75811",
  bookingRef: "AL-W1PUOVI8QI",
  totalAmount: 105_571,
  bookingAmount10: 10_557,
  amountPaid: 5_000,
  remaining10: 5_557,
  versions: [
    {
      id: "75742",
      quoteId: "75742",
      version: 1,
      label: "Version 1",
      customerQuoteUrl: "https://design.hubinterior.com/quote/75742",
      internalQuoteUrl: "https://design.hubinterior.com/quote/75742?internal=1",
      createdAt: "2026-10-10T14:40:00+05:30",
      amount: 99_091,
      isLatest: false,
    },
    {
      id: "75811",
      quoteId: "75811",
      version: 2,
      label: "Version 2",
      customerQuoteUrl: "https://design.hubinterior.com/quote/75811",
      internalQuoteUrl: "https://design.hubinterior.com/quote/75811?internal=1",
      createdAt: "2026-10-10T14:43:00+05:30",
      amount: 105_571,
      isLatest: true,
    },
  ] satisfies LeadQuoteOption[],
  dealQuoteId: "75811",
  history: [
    {
      id: "pay-1",
      sequence: 1,
      amount: 5_000,
      cumulativeReceived: 5_000,
      remainingAfter: 5_557,
      createdAt: "2026-10-10T14:08:00+05:30",
      source: "booking_done",
      paymentChannel: "OFFLINE",
      paymentMethod: "CASH",
      paymentKind: "TOKEN",
      recordedBy: "admin",
      notes: "",
      proofs: [{ id: "proof-1", originalFileName: "token.png", mimeType: "image/png" }],
      financeReviewStatus: "NOT_READY",
    },
  ] as PaymentHistoryEntry[],
};

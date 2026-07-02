import { formatQuoteAmount, type LeadQuoteOption } from "@/lib/crm-quote-links";
import {
  formatInvestmentRangeLabel,
  resolveBudgetLuxuryFocus,
  resolveLuxuryFocusFromAmount,
  type BudgetLuxuryFocus,
} from "@/lib/lead-budget-display";

export type InvestmentDisplaySource = "budget" | "quotation";

export type InvestmentDisplay = {
  source: InvestmentDisplaySource;
  investmentLabel: string;
  subtitle: string;
  luxuryFocus: BudgetLuxuryFocus;
};

export function buildBudgetInvestmentDisplay(
  budget: string,
  leadConfiguration: string,
): InvestmentDisplay {
  return {
    source: "budget",
    investmentLabel: formatInvestmentRangeLabel(budget),
    subtitle: leadConfiguration.trim()
      ? `Based on ${leadConfiguration.trim()} configuration from lead profile.`
      : "Budget from lead connection phase.",
    luxuryFocus: resolveBudgetLuxuryFocus(budget),
  };
}

export function buildQuotationInvestmentDisplay(
  quote: LeadQuoteOption,
  configuration: string,
  options?: { selectedInBookingDone?: boolean },
): InvestmentDisplay {
  const configLabel = configuration.trim() || "quoted configuration";
  const bookingNote = options?.selectedInBookingDone ? " (selected in Booking Done)" : "";
  const amount = quote.amount;

  return {
    source: "quotation",
    investmentLabel: amount != null ? formatQuoteAmount(amount) : "—",
    subtitle: `Based on ${configLabel} from ${quote.label}${bookingNote}.`,
    luxuryFocus:
      amount != null ? resolveLuxuryFocusFromAmount(amount) : resolveBudgetLuxuryFocus(""),
  };
}

"use client";

import { formatQuoteAmount } from "@/lib/crm-quote-links";
import {
  formatPaymentAmountInput,
  parsePaymentAmountInput,
} from "@/lib/booking-done-payment-storage";

type Props = {
  amountInput: string;
  remainingAmount: number;
  onAmountChange: (value: string) => void;
  onUseRemaining: () => void;
  disabled?: boolean;
  fieldError?: string;
  extraToFinance?: number;
};

export default function AmountInput({
  amountInput,
  remainingAmount,
  onAmountChange,
  onUseRemaining,
  disabled = false,
  fieldError,
  extraToFinance = 0,
}: Props) {
  const parsed = parsePaymentAmountInput(amountInput);
  const afterRemaining =
    parsed != null && parsed > 0
      ? Math.max(0, remainingAmount - Math.min(parsed, remainingAmount))
      : remainingAmount;

  return (
    <section>
      <label
        htmlFor="send-payment-amount"
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]"
      >
        Payment amount
      </label>
      <div className="mt-2 flex h-[60px] items-center gap-2 rounded-[14px] border border-[#CBD3DD] bg-white px-4 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/25">
        <span className="text-[22px] font-bold text-[#5B6778]" aria-hidden>
          ₹
        </span>
        <input
          id="send-payment-amount"
          type="text"
          inputMode="numeric"
          value={amountInput}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^\d]/g, "");
            if (!raw) {
              onAmountChange("");
              return;
            }
            const parsed = parsePaymentAmountInput(raw);
            onAmountChange(
              parsed != null ? formatPaymentAmountInput(parsed) : raw,
            );
          }}
          placeholder="0"
          className="h-full w-full bg-transparent text-[26px] font-bold tabular-nums text-[#0F172A] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? "send-payment-amount-error" : "send-payment-amount-help"}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onUseRemaining}
          disabled={disabled || remainingAmount <= 0}
          className="sp-chip inline-flex min-h-9 items-center rounded-full border border-[#047857]/30 bg-[#E7F6EF] px-3 text-[12px] font-semibold text-[#047857] hover:bg-[#d8f3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use full remaining {formatQuoteAmount(remainingAmount)}
        </button>
        <p className="text-[12px] font-medium text-[#5B6778]">
          After this payment, remaining {formatQuoteAmount(afterRemaining)}
        </p>
      </div>

      <p id="send-payment-amount-help" className="mt-2 text-[12px] leading-relaxed text-[#5B6778]">
        Up to {formatQuoteAmount(remainingAmount)} completes the 10% target. Anything above is
        recorded as extra and sent to Finance.
      </p>

      {extraToFinance > 0 ? (
        <p className="mt-2 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-900">
          {formatQuoteAmount(extraToFinance)} extra will be sent to Finance
        </p>
      ) : null}

      {fieldError ? (
        <p
          id="send-payment-amount-error"
          className="mt-2 text-[12px] text-[#b91c1c]"
          role="alert"
          aria-live="polite"
        >
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}

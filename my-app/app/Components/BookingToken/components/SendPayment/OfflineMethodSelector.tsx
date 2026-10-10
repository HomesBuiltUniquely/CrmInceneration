"use client";

import {
  OFFLINE_PAYMENT_METHODS,
  type OfflinePaymentMethodId,
} from "@/lib/booking-payment-display";

type Props = {
  method: OfflinePaymentMethodId | "";
  onChange: (method: OfflinePaymentMethodId) => void;
  disabled?: boolean;
  fieldError?: string;
};

function MethodIcon({ kind }: { kind: OfflinePaymentMethodId }) {
  if (kind === "CASH") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "CHEQUE") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <rect x="3" y="6.5" width="18" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 10h8M6 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "BANK_TRANSFER") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 5l8 5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6 10.5V18M10 10.5V18M14 10.5V18M18 10.5V18" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.5 18h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 11h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function OfflineMethodSelector({
  method,
  onChange,
  disabled = false,
  fieldError,
}: Props) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
        Offline method
      </p>
      <div
        role="radiogroup"
        aria-label="Offline method"
        className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {OFFLINE_PAYMENT_METHODS.map((item) => {
          const active = method === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(item.id)}
              className={`inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] border-2 px-2 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40 disabled:opacity-60 ${
                active
                  ? "border-[#D97706] bg-[#FFF8EB] text-[#92400E]"
                  : "border-[#E3E8EE] bg-white text-[#5B6778] hover:border-[#CBD3DD]"
              }`}
            >
              <MethodIcon kind={item.id} />
              {item.label}
            </button>
          );
        })}
      </div>
      {fieldError ? (
        <p className="mt-2 text-[12px] text-[#b91c1c]" role="alert" aria-live="polite">
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import {
  OFFLINE_PAYMENT_METHODS,
  type OfflinePaymentMethodId,
  type PaymentChannelChoice,
} from "@/lib/booking-payment-display";

type Props = {
  channel: PaymentChannelChoice;
  offlineMethod: OfflinePaymentMethodId | "";
  disabled?: boolean;
  onChannelChange: (channel: PaymentChannelChoice) => void;
  onOfflineMethodChange: (method: OfflinePaymentMethodId) => void;
};

const ONLINE_METHODS = [
  { id: "upi", label: "UPI", hint: "GPay · PhonePe · BHIM" },
  { id: "card", label: "Card", hint: "Debit · Credit" },
  { id: "netbanking", label: "Netbanking", hint: "All major banks" },
] as const;

function OnlineIcon({ kind }: { kind: (typeof ONLINE_METHODS)[number]["id"] }) {
  if (kind === "upi") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M7 8.5 12 4l5 4.5v7L12 20l-5-4.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "card") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <rect x="3.5" y="6" width="17" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9h8M8 12h5M8 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function OfflineIcon({ kind }: { kind: OfflinePaymentMethodId }) {
  if (kind === "CASH") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 10.5h1.2M16.8 14.5H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "CHEQUE") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <rect x="3" y="6.5" width="18" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 10h8M6 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.5 14.5h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "BANK_TRANSFER") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 11h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentChannelSelector({
  channel,
  offlineMethod,
  disabled = false,
  onChannelChange,
  onOfflineMethodChange,
}: Props) {
  const onlineActive = channel === "online";
  const offlineActive = channel === "offline";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
          Payment type
        </p>
        <p className="text-[11px] font-medium text-[#94a3b8]">
          {onlineActive ? "Payment link" : "Proof required"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChannelChange("online")}
          aria-pressed={onlineActive}
          className={`group relative overflow-hidden rounded-xl border px-3.5 py-3.5 text-left transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
            onlineActive
              ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.55)] ring-1 ring-emerald-200/80 scale-[1.01]"
              : "border-[#e5e7eb] bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_28px_-16px_rgba(16,185,129,0.45)]"
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-emerald-400 transition-transform duration-300 ${
              onlineActive ? "scale-x-100" : "group-hover:scale-x-100"
            }`}
            aria-hidden
          />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-[#111827]">Online</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
                Send payment link to the customer
              </p>
            </div>
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                onlineActive
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"
              }`}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path
                  d="M7 12h10M13 8l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ONLINE_METHODS.map((method) => (
              <span
                key={method.id}
                title={method.hint}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                  onlineActive
                    ? "border-emerald-200 bg-white text-emerald-800"
                    : "border-[#eef2f7] bg-[#f8fafc] text-[#64748b] group-hover:border-emerald-100 group-hover:text-emerald-700"
                }`}
              >
                <OnlineIcon kind={method.id} />
                {method.label}
              </span>
            ))}
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChannelChange("offline")}
          aria-pressed={offlineActive}
          className={`group relative overflow-hidden rounded-xl border px-3.5 py-3.5 text-left transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
            offlineActive
              ? "border-amber-400 bg-gradient-to-br from-amber-50 to-white shadow-[0_8px_24px_-12px_rgba(245,158,11,0.5)] ring-1 ring-amber-200/80 scale-[1.01]"
              : "border-[#e5e7eb] bg-white hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_10px_28px_-16px_rgba(245,158,11,0.4)]"
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-amber-400 transition-transform duration-300 ${
              offlineActive ? "scale-x-100" : "group-hover:scale-x-100"
            }`}
            aria-hidden
          />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-[#111827]">Offline</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
                Record cash / cheque / transfer with proof
              </p>
            </div>
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                offlineActive
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-amber-50 text-amber-800 group-hover:bg-amber-100"
              }`}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path
                  d="M12 4v16M8 8.5c0-1.7 1.8-3 4-3s4 1.3 4 3-1.8 3-4 3-4 1.3-4 3 1.8 3 4 3 4-1.3 4-3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {OFFLINE_PAYMENT_METHODS.map((method) => (
              <span
                key={method.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                  offlineActive
                    ? "border-amber-200 bg-white text-amber-900"
                    : "border-[#eef2f7] bg-[#f8fafc] text-[#64748b] group-hover:border-amber-100 group-hover:text-amber-800"
                }`}
              >
                <OfflineIcon kind={method.id} />
                {method.label}
              </span>
            ))}
          </div>
        </button>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          offlineActive
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-800/80">
              Choose offline method
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {OFFLINE_PAYMENT_METHODS.map((method) => {
                const active = offlineMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    disabled={disabled || !offlineActive}
                    onClick={() => onOfflineMethodChange(method.id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-all duration-200 disabled:opacity-60 ${
                      active
                        ? "border-amber-400 bg-white text-amber-950 shadow-sm scale-[1.02]"
                        : "border-transparent bg-white/70 text-[#4b5563] hover:-translate-y-0.5 hover:border-amber-200 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <OfflineIcon kind={method.id} />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { PaymentChannelChoice } from "@/lib/booking-payment-display";

type Props = {
  channel: PaymentChannelChoice;
  onChannelChange: (channel: PaymentChannelChoice) => void;
  disabled?: boolean;
  showOnline?: boolean;
};

const ONLINE_CHIPS = ["UPI", "Card", "Netbanking"] as const;

export default function PaymentTypeSelector({
  channel,
  onChannelChange,
  disabled = false,
  showOnline = true,
}: Props) {
  const onlineActive = channel === "online";
  const offlineActive = channel === "offline";

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
          Payment type
        </p>
        <p className="text-[11px] font-medium text-[#92400E]">Proof required for offline</p>
      </div>

      <div
        role="radiogroup"
        aria-label="Payment type"
        className={`mt-2 grid gap-2.5 ${showOnline ? "sm:grid-cols-2" : "grid-cols-1"}`}
      >
        {showOnline ? (
          <button
            type="button"
            role="radio"
            aria-checked={onlineActive}
            disabled={disabled}
            onClick={() => onChannelChange("online")}
            className={`min-h-[88px] rounded-2xl border-2 px-3.5 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:cursor-not-allowed disabled:opacity-60 ${
              onlineActive
                ? "border-[#047857] bg-[#E7F6EF]"
                : "border-[#E3E8EE] bg-white hover:border-[#CBD3DD]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-bold text-[#0F172A]">Online</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#5B6778]">
                  Send a payment link to the customer
                </p>
              </div>
              {onlineActive ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#047857] px-2 text-[10px] font-bold uppercase tracking-wide text-white">
                  Selected
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ONLINE_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#E3E8EE] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5B6778]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </button>
        ) : null}

        <button
          type="button"
          role="radio"
          aria-checked={offlineActive}
          disabled={disabled}
          onClick={() => onChannelChange("offline")}
          className={`min-h-[88px] rounded-2xl border-2 px-3.5 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40 disabled:cursor-not-allowed disabled:opacity-60 ${
            offlineActive
              ? "border-[#D97706] bg-[#FFF8EB]"
              : "border-[#E3E8EE] bg-white hover:border-[#CBD3DD]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-bold text-[#0F172A]">Offline</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[#5B6778]">
                Record cash, cheque or transfer with proof
              </p>
            </div>
            {offlineActive ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#D97706] px-2 text-[10px] font-bold uppercase tracking-wide text-white">
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                  <path
                    d="M3.5 8.2 6.4 11l6-6.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Selected
              </span>
            ) : null}
          </div>
        </button>
      </div>
    </section>
  );
}

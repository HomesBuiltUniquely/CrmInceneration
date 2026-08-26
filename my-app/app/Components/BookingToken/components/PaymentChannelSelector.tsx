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

export default function PaymentChannelSelector({
  channel,
  offlineMethod,
  disabled = false,
  onChannelChange,
  onOfflineMethodChange,
}: Props) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
        Payment type
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChannelChange("online")}
          className={`rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60 ${
            channel === "online"
              ? "border-emerald-300 bg-emerald-50"
              : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
          }`}
        >
          <p className="text-[12px] font-bold text-[#111827]">Online</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
            Send Easebuzz link (UPI / Card / Netbanking)
          </p>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChannelChange("offline")}
          className={`rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60 ${
            channel === "offline"
              ? "border-amber-300 bg-amber-50"
              : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
          }`}
        >
          <p className="text-[12px] font-bold text-[#111827]">Offline</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
            Cash, cheque, bank transfer, or DD with proof
          </p>
        </button>
      </div>

      {channel === "offline" ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
            Offline method
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {OFFLINE_PAYMENT_METHODS.map((method) => {
              const active = offlineMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onOfflineMethodChange(method.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
                    active
                      ? "border-amber-400 bg-amber-50 text-amber-900"
                      : "border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#d1d5db]"
                  }`}
                >
                  {method.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

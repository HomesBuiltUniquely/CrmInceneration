"use client";

import { useEffect, useRef, useState } from "react";

type SendPhase = "idle" | "flying" | "delivered";

type Props = {
  customerName: string;
  disabled?: boolean;
  busy?: boolean;
  onSend: () => Promise<boolean>;
  /** Called after success message has been shown (parent can close / refresh). */
  onDelivered?: () => void;
};

const FLIGHT_MS = 1600;
const SUCCESS_HOLD_MS = 1800;

export default function SendPaymentLinkButton({
  customerName,
  disabled = false,
  busy = false,
  onSend,
  onDelivered,
}: Props) {
  const [phase, setPhase] = useState<SendPhase>("idle");
  const [hovered, setHovered] = useState(false);
  const [arrived, setArrived] = useState(false);
  const deliveredOnceRef = useRef(false);
  const displayName = customerName.trim() || "customer";

  useEffect(() => {
    if (phase !== "flying") {
      setArrived(false);
      return;
    }
    const arriveTimer = window.setTimeout(() => setArrived(true), FLIGHT_MS - 120);
    return () => window.clearTimeout(arriveTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "delivered") return;
    if (deliveredOnceRef.current) return;
    deliveredOnceRef.current = true;
    const timer = window.setTimeout(() => {
      onDelivered?.();
    }, SUCCESS_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onDelivered]);

  const handleClick = async () => {
    if (disabled || busy || phase === "flying" || phase === "delivered") return;
    setPhase("flying");
    setArrived(false);
    const started = Date.now();
    let ok = false;
    try {
      ok = await onSend();
    } catch {
      ok = false;
    }
    const elapsed = Date.now() - started;
    const wait = Math.max(0, FLIGHT_MS - elapsed);
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    // Brief beat after plane touches the customer avatar
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    setPhase(ok ? "delivered" : "idle");
  };

  if (phase === "delivered") {
    return (
      <div className="flex w-full flex-col items-center animate-[crmFadeInUp_0.45s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex w-full max-w-sm items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white px-3.5 py-2.5 shadow-[0_10px_28px_-18px_rgba(16,185,129,0.85)]">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.9)] animate-[crmSuccessPop_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0 text-left">
            <p className="text-[12px] font-bold text-emerald-900">
              Successfully delivered your link
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-800/90">
              Customer <span className="font-semibold">{displayName}</span> got it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "flying") {
    return (
      <div className="flex w-full flex-col items-center">
        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white px-3 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Sending
            </span>
            <span
              className={`truncate text-[12px] font-bold transition-colors duration-300 ${
                arrived ? "text-emerald-700" : "text-[#0f172a]"
              }`}
            >
              {displayName}
            </span>
          </div>

          <div className="relative mx-1 h-11">
            {/* Track */}
            <div className="absolute left-4 right-4 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-500" />

            {/* Start */}
            <div className="absolute left-0 top-1/2 z-[1] -translate-y-1/2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-white text-[9px] font-bold uppercase text-emerald-700 shadow-sm">
                Link
              </span>
            </div>

            {/* Customer target */}
            <div
              className={`absolute right-0 top-1/2 z-[1] -translate-y-1/2 transition-transform duration-300 ${
                arrived ? "scale-110" : "scale-100"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md ring-4 transition-all duration-300 ${
                  arrived
                    ? "bg-emerald-600 ring-emerald-200"
                    : "bg-emerald-500 ring-emerald-100"
                }`}
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Plane */}
            <div
              className="pointer-events-none absolute top-1/2 z-[2] h-8 w-8 -translate-y-1/2"
              style={{
                animation: `crmPlaneFlight ${FLIGHT_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1) forwards`,
              }}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#05220f] text-[#1dde63] shadow-lg transition-opacity duration-200 ${
                  arrived ? "opacity-0" : "opacity-100"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 -rotate-12" fill="currentColor" aria-hidden>
                  <path d="M2.5 11.5 21 3.5l-6.8 17.2-2.9-6.4-5.3 2.2 1.5-5z" />
                </svg>
              </span>
            </div>
          </div>

          <p className="mt-1.5 text-center text-[11px] font-medium text-emerald-800/90">
            {arrived
              ? `Link reached ${displayName}…`
              : `Delivering payment link to ${displayName}…`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void handleClick()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative inline-flex h-9 min-w-[200px] items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-[#14c853] via-[#1dde63] to-[#22e66d] px-5 text-[12px] font-bold tracking-wide text-[#05220f] shadow-[0_8px_20px_-12px_rgba(29,222,99,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(29,222,99,0.95)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_20px_-12px_rgba(29,222,99,0.9)]"
      >
        <span
          className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ${
            hovered ? "translate-x-full" : "-translate-x-full"
          }`}
          aria-hidden
        />
        <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#05220f]/10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-12deg]">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M2.5 11.5 21 3.5l-6.8 17.2-2.9-6.4-5.3 2.2 1.5-5z" />
          </svg>
        </span>
        <span className="relative">{busy ? "Preparing…" : "Send Payment Link"}</span>
      </button>
    </div>
  );
}

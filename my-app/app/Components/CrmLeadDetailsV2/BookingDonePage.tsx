"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  leadType: string;
  leadId: string;
};

export default function BookingDonePage({ leadType, leadId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arrivedHandled = useRef(false);
  const [showArrivalPopup, setShowArrivalPopup] = useState(false);

  useEffect(() => {
    if (arrivedHandled.current) return;
    if (searchParams.get("arrived") !== "1") return;
    arrivedHandled.current = true;
    setShowArrivalPopup(true);
    router.replace(`/Leads/${leadType}/${leadId}/booking-done`);
  }, [leadId, leadType, router, searchParams]);

  useEffect(() => {
    if (!showArrivalPopup) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowArrivalPopup(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showArrivalPopup]);

  return (
    <main className="min-h-screen bg-[#eef1f5] px-3 py-4 font-sans md:px-4">
      <div className="mx-auto max-w-[900px]">
        <section className="rounded-xl border border-[#e1e6ed] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#16a34a]">
                Closed · Won
              </p>
              <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-[-0.02em] text-[#0f172a]">
                Booking Done
              </h1>
              <p className="mt-2 text-[14px] text-[#64748b]">
                Lead #{leadId} · {leadType}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#047857]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1ed760] text-[11px] text-white">
                ✓
              </span>
              Customer milestone
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MilestoneChip label="Stage" value="Closed" />
            <MilestoneChip label="Category" value="Closed Won" />
            <MilestoneChip label="Sub-stage" value="Booking Done (Booking)" highlight />
          </div>

          <p className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475569]">
            This lead has reached the booking-done milestone. Sales closure and token workflows can
            continue from here.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/Leads/${leadType}/${leadId}`}
              className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#d6dce6] bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#374151] transition hover:bg-[#f8fafc]"
            >
              Back to Lead Details
            </Link>
            <Link
              href="/booking-token"
              className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1dde63] px-4 text-[12px] font-bold uppercase tracking-wide text-[#05220f] transition hover:bg-[#1ed760]"
            >
              Open Booking & Token
            </Link>
          </div>
        </section>
      </div>

      {showArrivalPopup ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => setShowArrivalPopup(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#bbf7d0] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-arrived-title"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ecfdf5] text-[28px]">
              🎉
            </div>
            <h2
              id="lead-arrived-title"
              className="mt-4 text-center text-[20px] font-bold text-[#0f172a]"
            >
              Your lead came here
            </h2>
            <p className="mt-2 text-center text-[14px] leading-relaxed text-[#64748b]">
              Mark as Won moved this lead to the Booking Done page.
            </p>
            <button
              type="button"
              onClick={() => setShowArrivalPopup(false)}
              className="mt-5 flex h-10 w-full items-center justify-center rounded-[6px] bg-[#1dde63] text-[12px] font-bold uppercase tracking-wide text-[#05220f]"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MilestoneChip({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight
          ? "border-[#bbf7d0] bg-[#ecfdf5]"
          : "border-[#e2e8f0] bg-[#f8fafc]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]">{label}</p>
      <p
        className={`mt-1 text-[14px] font-bold ${
          highlight ? "text-[#047857]" : "text-[#1e293b]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

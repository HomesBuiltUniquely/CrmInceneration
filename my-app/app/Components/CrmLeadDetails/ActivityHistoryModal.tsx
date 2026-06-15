"use client";

import { useEffect } from "react";
import ActivityTimeline from "./ActivityTimeline";
import type { ActivityItem } from "@/lib/data";

export default function ActivityHistoryModal({
  activities,
  open,
  onClose,
}: {
  activities: ActivityItem[];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-history-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-5xl rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-app-bg)] p-4 shadow-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="activity-history-title"
            className="text-[18px] font-bold text-[var(--crm-text-primary)]"
          >
            Activity History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
          >
            Close
          </button>
        </div>
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  );
}

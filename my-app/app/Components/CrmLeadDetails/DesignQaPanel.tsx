"use client";

import { useEffect, useState } from "react";
import { fetchDesignQaForLead } from "@/lib/design-qa-client";

export default function DesignQaPanel({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<unknown | null>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDesignQaForLead(leadId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load design QA");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  return (
    <div className="mb-6 animate-fade-up delay-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-[var(--crm-surface)] px-5 py-2.5 text-[13px] font-semibold tracking-tight text-slate-800 shadow-sm transition hover:bg-[var(--crm-surface-subtle)] dark:border-[var(--crm-border-strong)] dark:text-[var(--crm-text-primary)]"
      >
        <span className="text-[15px] leading-none" aria-hidden>
          ✦
        </span>
        Design Preferences
      </button>

      {open ? (
        <section className="mt-4 rounded-[20px] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--crm-text-primary)]">Design QA</h2>
              <p className="mt-0.5 text-[11px] text-[var(--crm-text-muted)]">
                Second email path after a Connection meeting is fixed (with Google Meet mail). Uses designer / design preference email from Assignments.
              </p>
            </div>
            <span className="text-[11px] text-[var(--crm-text-muted)] shrink-0">GET /api/design-qa/lead/{leadId}</span>
          </div>
          {loading ? (
            <p className="text-[12px] text-[var(--crm-text-muted)]">Loading design QA…</p>
          ) : error ? (
            <p className="text-[12px] text-rose-600">{error}</p>
          ) : data === null ? (
            <p className="text-[12px] text-[var(--crm-text-muted)]">No design QA record for this lead.</p>
          ) : (
            <pre className="max-h-[240px] overflow-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3 text-[11px] leading-relaxed text-[var(--crm-text-secondary)]">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </section>
      ) : null}
    </div>
  );
}

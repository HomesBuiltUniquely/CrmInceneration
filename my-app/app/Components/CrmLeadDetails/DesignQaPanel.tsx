"use client";

import { useEffect, useState } from "react";
import { fetchDesignQaForLead } from "@/lib/design-qa-client";

type DesignQaAnswer = {
  question?: string;
  optionLabel?: string;
  selectedId?: number;
  selectedText?: string;
  imageUrl?: string;
};

type DesignQaSubmission = {
  id?: number | string;
  createdAt?: string;
  answers?: DesignQaAnswer[];
};

function asSubmissions(data: unknown): DesignQaSubmission[] {
  if (!Array.isArray(data)) return [];
  const rows = data as DesignQaSubmission[];
  return [...rows].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}

function formatSubmissionDate(value?: string): string {
  if (!value?.trim()) return "Submitted";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Submitted";
  return dt.toLocaleString();
}

export default function DesignQaPanel({
  leadId,
  open,
}: {
  leadId: string;
  open: boolean;
}) {
  const [data, setData] = useState<DesignQaSubmission[] | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (!open) return;
    if (!leadId.trim()) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDesignQaForLead(leadId)
      .then((d) => {
        if (cancelled) return;
        if (d === null) {
          setData(null);
          return;
        }
        setData(asSubmissions(d));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load design QA submissions.",
          );
        }
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
      {open ? (
        <section className="rounded-[20px] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                Design Preferences
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--crm-text-muted)]">
                Customer-submitted Design QA answers linked to this lead.
              </p>
            </div>
            <span className="text-[11px] text-[var(--crm-text-muted)] shrink-0">
              GET /api/design-qa/lead/{"{id}"}
            </span>
          </div>
          {loading ? (
            <p className="text-[12px] text-[var(--crm-text-muted)]">Loading design QA…</p>
          ) : error ? (
            <p className="text-[12px] text-rose-600">
              Could not load Design QA submissions. {error}
            </p>
          ) : !data || data.length === 0 ? (
            <p className="text-[12px] text-[var(--crm-text-muted)]">No design QA record for this lead.</p>
          ) : (
            <div className="space-y-3">
              {data.map((submission, index) => (
                <article
                  key={submission.id ?? `design-qa-${index}`}
                  className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-secondary)]">
                      Submission {index + 1}
                    </p>
                    <p className="text-[11px] text-[var(--crm-text-muted)]">
                      {formatSubmissionDate(submission.createdAt)}
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {(submission.answers ?? []).length === 0 ? (
                      <p className="text-[11px] text-[var(--crm-text-muted)]">
                        No answers in this submission.
                      </p>
                    ) : null}
                    {(submission.answers ?? []).map((answer, answerIdx) => (
                      <div
                        key={`${submission.id ?? index}-${answerIdx}`}
                        className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-2.5"
                      >
                        {answer.imageUrl ? (
                          <img
                            src={answer.imageUrl}
                            alt={answer.selectedText?.trim() || "Design QA answer"}
                            className="mb-2 h-28 w-28 rounded-md border border-[var(--crm-border)] object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <p className="text-[12px] font-medium text-[var(--crm-text-primary)]">
                          {answer.question?.trim() || "Question"}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
                          {answer.optionLabel?.trim() || "Option"}:{" "}
                          <span className="font-semibold text-[var(--crm-text-secondary)]">
                            {answer.selectedText?.trim() || "Not selected"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

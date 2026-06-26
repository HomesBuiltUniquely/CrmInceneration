"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  leadQuoteOptionFromSavedLink,
  normalizeLeadQuoteOptions,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  getLeadDetail,
  getNewCrmQuoteInternalLinkByLead,
  listNewCrmQuotesByLead,
} from "@/lib/lead-details-client";
import type { CrmLeadType } from "@/lib/leads-filter";

type Props = {
  leadType: string;
  leadId: string;
};

type QuoteLoadState = "idle" | "loading" | "ready" | "empty" | "error";

function pickDetailStr(detail: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = detail[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

async function fetchQuoteOptionsForIdentifier(identifier: string): Promise<LeadQuoteOption[]> {
  const id = identifier.trim();
  if (!id) return [];

  try {
    const listed = await listNewCrmQuotesByLead(id);
    const fromList = normalizeLeadQuoteOptions(listed);
    if (fromList.length > 0) return fromList;
  } catch {
    // Fall back to latest-only internal-link endpoint.
  }

  try {
    const latest = await getNewCrmQuoteInternalLinkByLead(id);
    return normalizeLeadQuoteOptions(latest);
  } catch {
    return [];
  }
}

function mergeQuoteOptions(...groups: LeadQuoteOption[][]): LeadQuoteOption[] {
  const byKey = new Map<string, LeadQuoteOption>();
  for (const group of groups) {
    for (const option of group) {
      const key = option.customerQuoteUrl || option.internalQuoteUrl || option.id;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, option);
    }
  }
  return normalizeLeadQuoteOptions([...byKey.values()]);
}

export default function BookingDonePage({ leadType, leadId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arrivedHandled = useRef(false);
  const [showArrivalPopup, setShowArrivalPopup] = useState(false);
  const [quoteLoadState, setQuoteLoadState] = useState<QuoteLoadState>("idle");
  const [quoteError, setQuoteError] = useState("");
  const [quoteOptions, setQuoteOptions] = useState<LeadQuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");

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

  useEffect(() => {
    if (!isCrmLeadType(leadType)) {
      setQuoteLoadState("error");
      setQuoteError("Invalid lead type.");
      return;
    }

    let cancelled = false;
    const validLeadType = leadType as CrmLeadType;

    async function loadQuotes() {
      setQuoteLoadState("loading");
      setQuoteError("");
      try {
        const detail = await getLeadDetail(validLeadType, leadId);
        if (cancelled) return;

        const businessLeadId = pickDetailStr(detail, "leadId", "leadRef", "leadCode", "customerId");
        const externalReferenceId = pickDetailStr(
          detail,
          "uniqueId",
          "lead_identifier",
          "leadIdentifier",
          "externalReferenceId",
        );
        const savedQuoteLink = pickDetailStr(detail, "quoteLink", "quoteURL", "proposalLink");

        const identifiers = [
          businessLeadId,
          externalReferenceId,
          leadId,
        ].filter((value, index, all) => value && all.indexOf(value) === index);

        const fetchedGroups = await Promise.all(
          identifiers.map((identifier) => fetchQuoteOptionsForIdentifier(identifier)),
        );
        if (cancelled) return;

        const savedOption = leadQuoteOptionFromSavedLink(savedQuoteLink);
        const merged = mergeQuoteOptions(
          ...fetchedGroups,
          savedOption ? [savedOption] : [],
        );

        if (merged.length === 0) {
          setQuoteOptions([]);
          setSelectedQuoteId("");
          setQuoteLoadState("empty");
          return;
        }

        setQuoteOptions(merged);
        setSelectedQuoteId(merged[0]?.id ?? "");
        setQuoteLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setQuoteOptions([]);
        setSelectedQuoteId("");
        setQuoteLoadState("error");
        setQuoteError(
          error instanceof Error
            ? error.message
            : "Unable to load quotations for this lead.",
        );
      }
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [leadId, leadType]);

  const selectedQuote = useMemo(
    () => quoteOptions.find((option) => option.id === selectedQuoteId) ?? quoteOptions[0] ?? null,
    [quoteOptions, selectedQuoteId],
  );

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

          <QuotationSection
            loadState={quoteLoadState}
            error={quoteError}
            options={quoteOptions}
            selectedQuoteId={selectedQuote?.id ?? selectedQuoteId}
            onSelectQuote={setSelectedQuoteId}
            selectedQuote={selectedQuote}
          />

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

function QuotationSection({
  loadState,
  error,
  options,
  selectedQuoteId,
  onSelectQuote,
  selectedQuote,
}: {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  selectedQuote: LeadQuoteOption | null;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2563eb]">
            Quotation
          </p>
          <p className="mt-1 text-[13px] text-[#475569]">
            Quote from the meeting-successful flow. Latest version is selected by default.
          </p>
        </div>
        {loadState === "ready" && options.length > 1 ? (
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
              Quote version
            </span>
            <select
              value={selectedQuoteId}
              onChange={(event) => onSelectQuote(event.target.value)}
              className="h-10 rounded-[6px] border border-[#cbd5e1] bg-white px-3 text-[13px] font-medium text-[#0f172a]"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loadState === "loading" ? (
        <p className="mt-4 text-[13px] text-[#64748b]">Loading quotations…</p>
      ) : null}

      {loadState === "error" ? (
        <p className="mt-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}

      {loadState === "empty" ? (
        <p className="mt-4 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[13px] text-[#92400e]">
          No quotation found for this lead yet. Generate one from lead details after meeting
          successful.
        </p>
      ) : null}

      {loadState === "ready" && selectedQuote ? (
        <div className="mt-4 space-y-3">
          {options.length === 1 ? (
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#334155]">
              {selectedQuote.label}
            </p>
          ) : null}

          <QuoteLinkRow
            label="Customer quote"
            url={selectedQuote.customerQuoteUrl}
            emptyText="Customer quote link is not available for this version."
          />
          <QuoteLinkRow
            label="Internal quote"
            url={selectedQuote.internalQuoteUrl}
            emptyText="Internal quote link is not available for this version."
          />
        </div>
      ) : null}
    </section>
  );
}

function QuoteLinkRow({
  label,
  url,
  emptyText,
}: {
  label: string;
  url: string;
  emptyText: string;
}) {
  const trimmed = url.trim();
  return (
    <div className="rounded-md border border-[#e2e8f0] bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]">{label}</p>
      {trimmed ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[13px] font-medium text-[#2563eb] underline-offset-2 hover:underline"
          >
            {trimmed}
          </a>
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] px-3 text-[11px] font-bold uppercase tracking-wide text-[#334155]"
          >
            Open
          </a>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-[#64748b]">{emptyText}</p>
      )}
    </div>
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

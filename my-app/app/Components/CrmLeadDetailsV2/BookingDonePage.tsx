"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatQuoteAmount,
  leadQuoteOptionFromSavedLink,
  normalizeLeadQuoteOptions,
  extractQuoteIdFromUrl,
  resolveQuoteVerifyUrl,
  sortQuotesForRevisionDisplay,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { buildLeadQuoteOptionsFromProlance } from "@/lib/prolance-quote-api";
import PaymentProofUploadSection from "@/app/Components/CrmLeadDetailsV2/PaymentProofUploadSection";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  buildBookingTokenLeadFromBookingDone,
  upsertBookingTokenLead,
  validateBookingDoneHandoff,
} from "@/lib/booking-token-leads";
import {
  getLeadDetail,
  fetchNewCrmQuotePayloads,
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

type QuoteLoadResult = {
  options: LeadQuoteOption[];
  hubLeadId: string;
};

async function fetchQuoteOptionsForLead(
  businessLeadId: string,
  externalReferenceId: string,
  savedQuoteLink: string,
): Promise<QuoteLoadResult> {
  const payloads = await fetchNewCrmQuotePayloads(businessLeadId, externalReferenceId);
  const anchorQuoteId = resolveAnchorQuoteId(payloads, savedQuoteLink);
  const hubLeadId = resolveHubLeadId(payloads);

  if (anchorQuoteId) {
    try {
      const prolanceOptions = await buildLeadQuoteOptionsFromProlance(anchorQuoteId, hubLeadId);
      if (prolanceOptions.length > 0) {
        return { options: prolanceOptions, hubLeadId };
      }
    } catch {
      // Fall back to CRM quote-link payloads below.
    }
  }

  const fallback = mergeQuoteOptions(
    ...payloads.map((payload) => normalizeLeadQuoteOptions(payload)),
    ...(savedQuoteLink ? [leadQuoteOptionFromSavedLink(savedQuoteLink)].filter(Boolean) : []),
  );
  return { options: fallback, hubLeadId };
}

function resolveHubLeadId(payloads: unknown[]): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const hubLeadId = row.leadId;
    if (typeof hubLeadId === "number" && Number.isFinite(hubLeadId) && hubLeadId > 0) {
      return String(Math.trunc(hubLeadId));
    }
    if (typeof hubLeadId === "string" && /^\d+$/.test(hubLeadId.trim())) {
      return hubLeadId.trim();
    }
  }
  return "";
}

function resolveAnchorQuoteId(payloads: unknown[], savedQuoteLink: string): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const quoteId = row.quoteId;
    if (typeof quoteId === "number" && Number.isFinite(quoteId) && quoteId > 0) {
      return String(Math.trunc(quoteId));
    }
    if (typeof quoteId === "string" && /^\d+$/.test(quoteId.trim())) {
      return quoteId.trim();
    }
    const fromUrl =
      extractQuoteIdFromUrl(String(row.customerQuoteUrl ?? "")) ||
      extractQuoteIdFromUrl(String(row.internalQuoteUrl ?? ""));
    if (fromUrl) return fromUrl;
  }
  return extractQuoteIdFromUrl(savedQuoteLink);
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
  const [hubLeadId, setHubLeadId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessLeadId, setBusinessLeadId] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [handoffPending, setHandoffPending] = useState(false);

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

        const resolvedBusinessLeadId = pickDetailStr(detail, "leadId", "leadRef", "leadCode", "customerId");
        const resolvedCustomerName = pickDetailStr(
          detail,
          "name",
          "customerName",
          "leadName",
          "fullName",
          "contactName",
        );
        setBusinessLeadId(resolvedBusinessLeadId);
        setCustomerName(resolvedCustomerName);
        const externalReferenceId = pickDetailStr(
          detail,
          "uniqueId",
          "lead_identifier",
          "leadIdentifier",
          "externalReferenceId",
        );
        const savedQuoteLink = pickDetailStr(detail, "quoteLink", "quoteURL", "proposalLink");

        const { options: merged, hubLeadId: resolvedHubLeadId } = await fetchQuoteOptionsForLead(
          resolvedBusinessLeadId,
          externalReferenceId,
          savedQuoteLink,
        );
        if (cancelled) return;

        if (merged.length === 0) {
          setQuoteOptions([]);
          setSelectedQuoteId("");
          setHubLeadId("");
          setQuoteLoadState("empty");
          return;
        }

        setHubLeadId(resolvedHubLeadId);
        setQuoteOptions(merged);
        const defaultSelection =
          merged.find((option) => option.isLatest)?.id ?? merged[0]?.id ?? "";
        setSelectedQuoteId(defaultSelection);
        setQuoteLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setQuoteOptions([]);
        setSelectedQuoteId("");
        setHubLeadId("");
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

  async function handleOpenBookingToken() {
    setHandoffError("");
    const validation = validateBookingDoneHandoff({
      leadType,
      leadId,
      customerName,
      businessLeadId,
      hubLeadId,
      selectedQuote,
    });
    if (!validation.ok) {
      setHandoffError(validation.message);
      return;
    }

    setHandoffPending(true);
    try {
      const record = buildBookingTokenLeadFromBookingDone({
        leadType,
        leadId,
        customerName,
        businessLeadId,
        hubLeadId,
        selectedQuote,
      });
      upsertBookingTokenLead(record);
      router.push(`/booking-token?from=booking-done&highlight=${encodeURIComponent(record.id)}`);
    } finally {
      setHandoffPending(false);
    }
  }

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
            hubLeadId={hubLeadId}
            selectedQuoteId={selectedQuote?.id ?? selectedQuoteId}
            onSelectQuote={setSelectedQuoteId}
            selectedQuote={selectedQuote}
          />

          <PaymentProofUploadSection
            leadType={leadType}
            leadId={leadId}
            selectedQuote={selectedQuote}
          />

          <p className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475569]">
            This lead has reached the booking-done milestone. Sales closure and token workflows can
            continue from here.
          </p>

          {handoffError ? (
            <p className="mt-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
              {handoffError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/Leads/${leadType}/${leadId}`}
              className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#d6dce6] bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#374151] transition hover:bg-[#f8fafc]"
            >
              Back to Lead Details
            </Link>
            <button
              type="button"
              onClick={() => void handleOpenBookingToken()}
              disabled={handoffPending}
              className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1dde63] px-4 text-[12px] font-bold uppercase tracking-wide text-[#05220f] transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {handoffPending ? "Sending…" : "Open Booking & Token"}
            </button>
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
  hubLeadId,
  selectedQuoteId,
  onSelectQuote,
  selectedQuote,
}: {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  selectedQuote: LeadQuoteOption | null;
}) {
  const revisionOptions = sortQuotesForRevisionDisplay(options);

  return (
    <section className="mt-6 rounded-lg border border-[#e8dfd8] bg-[#fffaf8] p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[16px] text-[#b4534a]" aria-hidden>
          🕒
        </span>
        <div>
          <p className="text-[15px] font-bold text-[#3f2b23]">Revision History</p>
          <p className="mt-1 text-[13px] text-[#7c665d]">
            Each revision is saved for your reference. Click a version to open the quotation and
            verify it, then use that price for booking.
          </p>
        </div>
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

      {loadState === "ready" && revisionOptions.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {revisionOptions.map((option) => {
              const selected = option.id === selectedQuoteId;
              const quoteUrl = resolveQuoteVerifyUrl(option, hubLeadId);
              return (
                <a
                  key={option.id}
                  href={quoteUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onSelectQuote(option.id)}
                  className={`block rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[#d7b0aa] bg-[#fff1ef] shadow-[inset_4px_0_0_#9f3d33]"
                      : "border-[#e7ddd7] bg-white hover:border-[#d7c5bf] hover:bg-[#fffdfb]"
                  } ${quoteUrl ? "cursor-pointer" : "pointer-events-none opacity-70"}`}
                >
                  <p className="text-[15px] font-bold text-[#3f2b23]">{option.label}</p>
                  <p className="mt-2 text-[12px] text-[#8b766d]">
                    Created on {formatQuoteCreatedAt(option.createdAt)}
                  </p>
                  {option.quoteId ? (
                    <p className="mt-1 text-[12px] text-[#8b766d]">ID {option.quoteId}</p>
                  ) : null}
                  <p className="mt-3 text-[18px] font-bold text-[#1f2937]">
                    {formatQuoteAmount(option.amount)}
                  </p>
                  {quoteUrl ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#b4534a]">
                      Open quotation →
                    </p>
                  ) : null}
                </a>
              );
            })}
          </div>

          {selectedQuote ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#047857]">
                Selected for booking
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[#065f46]">
                {selectedQuote.label} · {formatQuoteAmount(selectedQuote.amount)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatQuoteCreatedAt(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatCrmDateTime(value);
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  fileToPaymentProof,
  formatPaymentAmountInput,
  getPaymentProofLimits,
  parsePaymentAmountInput,
  readPaymentAmount,
  readPaymentProofs,
  validatePaymentProofFile,
  writePaymentAmount,
  writePaymentProofs,
  type PaymentProofFile,
} from "@/lib/booking-done-payment-storage";
import {
  bookingPaymentKindDescription,
  bookingPaymentKindLabel,
  calculateBookingTenPercent,
  classifyBookingPayment,
} from "@/lib/booking-done-payment-rules";
import { formatQuoteAmount } from "@/lib/crm-quote-links";
import type { LeadQuoteOption } from "@/lib/crm-quote-links";

type Props = {
  leadType: string;
  leadId: string;
  selectedQuote?: LeadQuoteOption | null;
  quoteAmountRefreshing?: boolean;
  /** Parent re-reads draft amount from storage (confirm button enable). */
  onPaymentDraftChange?: () => void;
};

export default function PaymentProofUploadSection({
  leadType,
  leadId,
  selectedQuote = null,
  quoteAmountRefreshing = false,
  onPaymentDraftChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PaymentProofFile[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { maxFiles } = getPaymentProofLimits();

  useEffect(() => {
    setFiles(readPaymentProofs(leadType, leadId));
    setAmountInput(readPaymentAmount(leadType, leadId));
  }, [leadId, leadType]);

  const persist = useCallback(
    (next: PaymentProofFile[]) => {
      setFiles(next);
      writePaymentProofs(leadType, leadId, next);
    },
    [leadId, leadType],
  );

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const selected = Array.from(incoming);
      if (selected.length === 0) return;

      setError("");
      if (files.length >= maxFiles) {
        setError(`You can upload up to ${maxFiles} payment screenshots.`);
        return;
      }

      const remaining = maxFiles - files.length;
      const batch = selected.slice(0, remaining);
      if (selected.length > remaining) {
        setError(`Only ${remaining} more screenshot${remaining === 1 ? "" : "s"} can be added.`);
      }

      setBusy(true);
      try {
        const nextFiles = [...files];
        for (const file of batch) {
          const validationError = validatePaymentProofFile(file);
          if (validationError) {
            setError(validationError);
            continue;
          }
          nextFiles.push(await fileToPaymentProof(file));
        }
        persist(nextFiles);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to add payment screenshot.",
        );
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [files, maxFiles, persist],
  );

  const removeFile = (id: string) => {
    persist(files.filter((file) => file.id !== id));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void addFiles(event.dataTransfer.files);
  };

  const placeholderCount = Math.max(0, 3 - files.length);

  const receivedAmount = useMemo(
    () => parsePaymentAmountInput(amountInput),
    [amountInput],
  );
  const tenPercentAmount = useMemo(
    () => calculateBookingTenPercent(selectedQuote?.amount),
    [selectedQuote?.amount],
  );
  const paymentKind = useMemo(
    () => classifyBookingPayment(receivedAmount, selectedQuote?.amount),
    [receivedAmount, selectedQuote?.amount],
  );

  const fillTenPercent = () => {
    if (tenPercentAmount == null) return;
    const formatted = formatPaymentAmountInput(tenPercentAmount);
    setAmountInput(formatted);
    writePaymentAmount(leadType, leadId, formatted);
    onPaymentDraftChange?.();
  };

  const commitAmountDraft = useCallback(
    (raw: string) => {
      const parsed = parsePaymentAmountInput(raw);
      if (parsed === null) {
        setAmountInput("");
        writePaymentAmount(leadType, leadId, "");
        onPaymentDraftChange?.();
        return;
      }
      const formatted = formatPaymentAmountInput(parsed);
      setAmountInput(formatted);
      writePaymentAmount(leadType, leadId, formatted);
      onPaymentDraftChange?.();
    },
    [leadId, leadType, onPaymentDraftChange],
  );

  return (
    <section className="mt-6 rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[16px]" aria-hidden>
          📎
        </span>
        <div>
          <p className="text-[15px] font-bold text-[#1e3a8a]">Payment Proof</p>
          <p className="mt-1 text-[13px] text-[#475569]">
            Enter the payment amount received and upload screenshots (UPI, bank transfer, cheque,
            etc.).
          </p>
        </div>
      </div>

      <label className="mt-4 block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
            Amount received
          </span>
          {tenPercentAmount != null ? (
            <button
              type="button"
              onClick={fillTenPercent}
              className="text-[11px] font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
            >
              Use 10% amount ({formatQuoteAmount(tenPercentAmount)})
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex overflow-hidden rounded-lg border border-[#bfdbfe] bg-white focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#dbeafe]">
          <span className="inline-flex items-center border-r border-[#dbeafe] bg-[#eff6ff] px-3 text-[14px] font-semibold text-[#1e3a8a]">
            ₹
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => {
              const next = event.target.value;
              setAmountInput(next);
              writePaymentAmount(leadType, leadId, next);
              onPaymentDraftChange?.();
            }}
            onBlur={() => commitAmountDraft(amountInput)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitAmountDraft(amountInput);
              }
            }}
            placeholder="Enter amount received"
            className="h-11 w-full px-3 text-[15px] font-semibold text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#94a3b8]"
          />
        </div>
        {quoteAmountRefreshing ? (
          <p className="mt-2 text-[12px] text-[#64748b]">Loading quotation amount…</p>
        ) : selectedQuote?.amount != null ? (
          <div className="mt-2 space-y-1">
            <p className="text-[12px] text-[#64748b]">
              Selected quotation amount: {formatQuoteAmount(selectedQuote.amount)}
            </p>
            {tenPercentAmount != null ? (
              <p className="text-[12px] font-semibold text-[#1e3a8a]">
                Required 10% booking advance: {formatQuoteAmount(tenPercentAmount)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[#64748b]">
            Select a quotation version above to calculate the 10% booking amount.
          </p>
        )}
      </label>

      {paymentKind && receivedAmount != null ? (
        <div
          className={`mt-3 rounded-lg border px-4 py-3 ${
            paymentKind === "FULL_10%"
              ? "border-[#bbf7d0] bg-[#ecfdf5]"
              : "border-[#fde68a] bg-[#fffbeb]"
          }`}
        >
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.1em] ${
              paymentKind === "FULL_10%" ? "text-[#047857]" : "text-[#b45309]"
            }`}
          >
            {bookingPaymentKindLabel(paymentKind)}
          </p>
          <p
            className={`mt-1 text-[13px] ${
              paymentKind === "FULL_10%" ? "text-[#065f46]" : "text-[#92400e]"
            }`}
          >
            {bookingPaymentKindDescription(paymentKind, receivedAmount, tenPercentAmount)} Received:{" "}
            {formatQuoteAmount(receivedAmount)}
          </p>
        </div>
      ) : null}

      <div
        className={`mt-4 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragActive
            ? "border-[#2563eb] bg-[#eff6ff]"
            : "border-[#bfdbfe] bg-white hover:border-[#93c5fd] hover:bg-[#f8fbff]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={onDrop}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff] text-[22px]">
          🖼️
        </div>
        <p className="mt-3 text-[14px] font-semibold text-[#1e293b]">
          Drop payment screenshots here
        </p>
        <p className="mt-1 text-[12px] text-[#64748b]">
          PNG, JPG, or WEBP · up to {maxFiles} files · 8 MB each
        </p>
        <button
          type="button"
          disabled={busy || files.length >= maxFiles}
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-[6px] bg-[#2563eb] px-4 text-[12px] font-bold uppercase tracking-wide text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload screenshots"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
          }}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}

      {files.length > 0 || placeholderCount > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {files.map((file) => (
            <article
              key={file.id}
              className="overflow-hidden rounded-xl border border-[#dbeafe] bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-[#f1f5f9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[12px] font-bold text-white"
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </div>
              <div className="px-3 py-2">
                <p className="truncate text-[12px] font-semibold text-[#1e293b]">{file.name}</p>
                <p className="mt-0.5 text-[11px] text-[#64748b]">
                  {formatUploadedAt(file.uploadedAt)}
                </p>
              </div>
            </article>
          ))}

          {Array.from({ length: placeholderCount }).map((_, index) => (
            <div
              key={`placeholder-${index}`}
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 text-center"
            >
              <span className="text-[28px] text-[#cbd5e1]" aria-hidden>
                +
              </span>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Screenshot slot
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <p className="mt-3 text-[12px] text-[#64748b]">
          {files.length} screenshot{files.length === 1 ? "" : "s"} saved for this lead.
        </p>
      ) : null}
    </section>
  );
}

function formatUploadedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Uploaded recently";
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

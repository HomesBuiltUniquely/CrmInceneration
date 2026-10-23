"use client";

import type { ChangeEvent, DragEvent, ReactNode, RefObject } from "react";
import type { LeadQuoteOption } from "@/lib/crm-quote-links";
import type { PaymentHistoryEntry } from "@/lib/booking-payment-history-api";
import type { OfflinePaymentMethodId, PaymentChannelChoice } from "@/lib/booking-payment-display";
import { formatPaymentMethod } from "@/lib/booking-payment-display";
import type { QuoteLoadState } from "../BookingQuoteVersionPicker";
import SummaryStats from "./SummaryStats";
import QuotationVersionPicker from "./QuotationVersionPicker";
import PaymentHistoryList, { type HistoryFilter } from "./PaymentHistoryList";
import PaymentTypeSelector from "./PaymentTypeSelector";
import OfflineMethodSelector from "./OfflineMethodSelector";
import AmountInput from "./AmountInput";
import ProofUploader, { type DraftProof } from "./ProofUploader";
import type { SendPaymentFieldErrors } from "./schema";
import SoftScroll from "./SoftScroll";

type Props = {
  totalAmount: number;
  bookingAmount10: number;
  amountPaid: number;
  remaining10: number;
  quoteLoadState: QuoteLoadState;
  quoteError: string;
  quoteOptions: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  selectedQuote: LeadQuoteOption | null;
  dealQuoteId?: string | null;
  dealVersionLabel?: string | null;
  quoteAmountRefreshing?: boolean;
  onSelectQuote: (id: string) => void;
  historyLoading: boolean;
  history: PaymentHistoryEntry[];
  paymentCount: number;
  proofCount: number;
  historyFilter: HistoryFilter;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  selectedEntryId: string;
  onSelectEntry: (id: string) => void;
  showHistoryFilters?: boolean;
  channel: PaymentChannelChoice;
  onChannelChange: (channel: PaymentChannelChoice) => void;
  showOnlineChannel?: boolean;
  offlineMethod: OfflinePaymentMethodId | "";
  onOfflineMethodChange: (method: OfflinePaymentMethodId) => void;
  amountInput: string;
  onAmountChange: (value: string) => void;
  onUseRemaining: () => void;
  extraToFinance?: number;
  notes: string;
  onNotesChange: (value: string) => void;
  draftProofs: DraftProof[];
  dragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickFiles: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onRemoveProof: (id: string) => void;
  onPreviewProof: (proof: DraftProof) => void;
  fieldErrors?: SendPaymentFieldErrors;
  disabled?: boolean;
  submitting?: boolean;
  primaryLabel: string;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  bannerSlot?: ReactNode;
  helperSlot?: ReactNode;
  middleTopSlot?: ReactNode;
  /** When true, middle column shows only payment history detail (no type/amount form). */
  historyDetailOpen?: boolean;
};

function NotesField({
  notes,
  onNotesChange,
  disabled,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor="send-payment-notes"
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]"
      >
        Notes (optional)
      </label>
      <textarea
        id="send-payment-notes"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        disabled={disabled}
        rows={2}
        className="mt-1.5 h-[64px] w-full resize-none rounded-[14px] border border-[#CBD3DD] bg-white px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/25 disabled:opacity-60"
        placeholder="UPI ref, bank transfer note…"
      />
    </div>
  );
}

function FooterActions({
  recap,
  fieldErrors,
  primaryLabel,
  onPrimaryAction,
  primaryDisabled,
  submitting,
}: {
  recap: string;
  fieldErrors?: SendPaymentFieldErrors;
  primaryLabel: string;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  submitting: boolean;
}) {
  return (
    <div className="shrink-0 space-y-2 border-t border-[#E3E8EE] bg-white pt-3">
      <p className="text-[12px] text-[#5B6778]">{recap}</p>
      {fieldErrors?.root ? (
        <p className="text-[12px] text-[#b91c1c]" role="alert" aria-live="polite">
          {fieldErrors.root}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={primaryDisabled || submitting}
        className="sp-primary inline-flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[#047857] text-[15px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
            Submitting…
          </>
        ) : (
          primaryLabel
        )}
      </button>
    </div>
  );
}

export default function SendPaymentBody({
  totalAmount,
  bookingAmount10,
  amountPaid,
  remaining10,
  quoteLoadState,
  quoteError,
  quoteOptions,
  hubLeadId,
  selectedQuoteId,
  selectedQuote,
  dealQuoteId,
  dealVersionLabel,
  quoteAmountRefreshing,
  onSelectQuote,
  historyLoading,
  history,
  paymentCount,
  proofCount,
  historyFilter,
  onHistoryFilterChange,
  selectedEntryId,
  onSelectEntry,
  showHistoryFilters = true,
  channel,
  onChannelChange,
  showOnlineChannel = true,
  offlineMethod,
  onOfflineMethodChange,
  amountInput,
  onAmountChange,
  onUseRemaining,
  extraToFinance = 0,
  notes,
  onNotesChange,
  draftProofs,
  dragActive,
  fileInputRef,
  onPickFiles,
  onFileInputChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onRemoveProof,
  onPreviewProof,
  fieldErrors,
  disabled = false,
  submitting = false,
  primaryLabel,
  onPrimaryAction,
  primaryDisabled = false,
  bannerSlot,
  helperSlot,
  middleTopSlot,
  historyDetailOpen = false,
}: Props) {
  const offline = channel === "offline";
  const showProof = offline || !showOnlineChannel;
  const showPayForm = !historyDetailOpen;
  const versionLabel =
    selectedQuote?.version != null
      ? `Version ${selectedQuote.version}`
      : selectedQuote?.label?.replace(/\s*\(Current\)\s*/i, "") || "Version";
  const methodLabel = offlineMethod ? formatPaymentMethod(offlineMethod) : "—";
  const recap =
    channel === "online"
      ? `Online · Payment link · ${versionLabel}`
      : `Offline · ${methodLabel} · ${versionLabel}`;

  const quotePicker = (
    <QuotationVersionPicker
      loadState={quoteLoadState}
      error={quoteError}
      options={quoteOptions}
      hubLeadId={hubLeadId}
      selectedQuoteId={selectedQuoteId}
      onSelectQuote={onSelectQuote}
      dealQuoteId={dealQuoteId}
      dealVersionLabel={dealVersionLabel}
      amountRefreshing={quoteAmountRefreshing}
      disabled={disabled}
      fieldError={fieldErrors?.versionId}
    />
  );

  const historyList = (
    <PaymentHistoryList
      loading={historyLoading}
      history={history}
      paymentCount={paymentCount}
      proofCount={proofCount}
      filter={historyFilter}
      onFilterChange={onHistoryFilterChange}
      selectedEntryId={selectedEntryId}
      onSelectEntry={onSelectEntry}
      showFilters={showHistoryFilters}
    />
  );

  const typeSelector = (
    <PaymentTypeSelector
      channel={channel}
      onChannelChange={onChannelChange}
      disabled={disabled}
      showOnline={showOnlineChannel}
    />
  );

  const methodSelector = offline ? (
    <OfflineMethodSelector
      method={offlineMethod}
      onChange={onOfflineMethodChange}
      disabled={disabled}
      fieldError={fieldErrors?.method}
    />
  ) : null;

  const amountField = (
    <AmountInput
      amountInput={amountInput}
      remainingAmount={remaining10}
      onAmountChange={onAmountChange}
      onUseRemaining={onUseRemaining}
      disabled={disabled}
      fieldError={fieldErrors?.amount}
      extraToFinance={extraToFinance}
    />
  );

  const notesField = (
    <NotesField notes={notes} onNotesChange={onNotesChange} disabled={disabled} />
  );

  const proofField = showProof ? (
    <ProofUploader
      required={offline}
      draftProofs={draftProofs}
      dragActive={dragActive}
      fileInputRef={fileInputRef}
      disabled={disabled}
      fieldError={fieldErrors?.proofCount}
      onPickFiles={onPickFiles}
      onFileInputChange={onFileInputChange}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onRemoveProof={onRemoveProof}
      onPreviewProof={onPreviewProof}
    />
  ) : (
    <div className="rounded-2xl border border-dashed border-[#E3E8EE] bg-[#F7F9FA] px-4 py-4 text-center">
      <p className="text-[13px] font-semibold text-[#0F172A]">Proof not required</p>
      <p className="mt-1 text-[12px] text-[#5B6778]">
        Online payments use a payment link — no screenshot needed.
      </p>
    </div>
  );

  const footer = (
    <FooterActions
      recap={recap}
      fieldErrors={fieldErrors}
      primaryLabel={primaryLabel}
      onPrimaryAction={onPrimaryAction}
      primaryDisabled={primaryDisabled}
      submitting={submitting}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SummaryStats
        totalAmount={totalAmount}
        bookingAmount10={bookingAmount10}
        amountPaid={amountPaid}
        remaining10={remaining10}
      />

      {bannerSlot || helperSlot ? (
        <div className="shrink-0 space-y-2 border-b border-[#E3E8EE] px-5 py-2.5">
          {helperSlot}
          {bannerSlot}
        </div>
      ) : null}

      {/* Mobile (&lt;768): soft-fade only when content overflows; Save sticky */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        <SoftScroll
          className={`min-h-0 flex-1 basis-0 px-4 py-4 ${showPayForm ? "pb-28" : "pb-4"}`}
          padClassName="space-y-4"
        >
          {historyDetailOpen ? (
            <div className="min-h-0">{middleTopSlot}</div>
          ) : (
            <>
              {quotePicker}
              <div className="flex min-h-[200px] flex-col">{historyList}</div>
              {middleTopSlot}
              {typeSelector}
              {methodSelector}
              {amountField}
              {notesField}
              {proofField}
            </>
          )}
        </SoftScroll>
        {showPayForm ? (
          <div className="sticky bottom-0 z-10 border-t border-[#E3E8EE] bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)]">
            {footer}
          </div>
        ) : null}
      </div>

      {/* Desktop / laptop: soft-fade only when that column actually overflows */}
      <div className="hidden min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(260px,300px)] lg:grid-cols-[340px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-[#E3E8EE] bg-[#F7F9FA] px-3 py-3">
          <div className="shrink-0">{quotePicker}</div>
          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#0F172A]/15 pt-2.5">
            {historyList}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden px-4 py-4">
          {historyDetailOpen ? (
            <SoftScroll className="min-h-0 flex-1 basis-0">{middleTopSlot}</SoftScroll>
          ) : (
            <SoftScroll
              className="min-h-0 flex-1 basis-0"
              padClassName="sp-stagger flex flex-col gap-4"
            >
              {middleTopSlot}
              {typeSelector}
              {methodSelector}
              {amountField}
            </SoftScroll>
          )}
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-[#E3E8EE] px-4 py-4">
          {historyDetailOpen ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E3E8EE] bg-[#F7F9FA] px-4 text-center">
              <p className="text-[13px] font-semibold text-[#0F172A]">Viewing payment</p>
              <p className="mt-1 text-[12px] text-[#5B6778]">
                Use ← Back to payment form to record a new payment.
              </p>
            </div>
          ) : (
            <>
              {/* Notes + proof soft-scroll together; Save stays pinned */}
              <SoftScroll
                className="min-h-0 flex-1 basis-0"
                padClassName="space-y-3 pb-1"
              >
                {notesField}
                {proofField}
              </SoftScroll>
              <div className="mt-3 shrink-0 border-t border-[#E3E8EE] pt-3">
                {footer}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

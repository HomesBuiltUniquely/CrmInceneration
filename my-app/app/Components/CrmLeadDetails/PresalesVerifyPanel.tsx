"use client";

import { FieldLabel, Input, Select } from "./ui";

export type PresalesSalesExecutiveOption = {
  id: number;
  fullName?: string;
  username?: string;
  active?: boolean;
};

type Props = {
  pincode: string;
  onPincodeChange: (value: string) => void;
  salesExecutiveId: string;
  onSalesExecutiveIdChange: (value: string) => void;
  salesExecutiveOptions: PresalesSalesExecutiveOption[];
  salesExecutivesLoading?: boolean;
  salesExecutivesError?: string | null;
  salesExecutiveLabel: (u: PresalesSalesExecutiveOption) => string;
  showErrors?: boolean;
  pincodeMissing?: boolean;
  handoffLabel?: string;
  /** Modal title — e.g. "Verify WhatsApp Lead" for whatsapplead. */
  title?: string;
};

function HandoffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M21 3l-7.5 7.5" />
      <path d="M3 21l7.5-7.5" />
    </svg>
  );
}

const FIELD_FOOTER_MIN_H = "min-h-[14px]";

export default function PresalesVerifyPanel({
  pincode,
  onPincodeChange,
  salesExecutiveId,
  onSalesExecutiveIdChange,
  salesExecutiveOptions,
  salesExecutivesLoading = false,
  salesExecutivesError = null,
  salesExecutiveLabel,
  showErrors = false,
  pincodeMissing = false,
  handoffLabel,
  title = "Verify & hand off to sales",
}: Props) {
  const salesFooterMessage = salesExecutivesLoading
    ? "Loading…"
    : salesExecutivesError
      ? salesExecutivesError
      : salesExecutiveOptions.length === 0
        ? "List unavailable — verify with pincode only."
        : "";

  return (
    <section
      className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]"
      aria-labelledby="presales-verify-panel-title"
    >
      <div className="flex items-start gap-2.5 border-b border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--crm-success-bg)] text-[var(--crm-success-text)]"
          aria-hidden="true"
        >
          <HandoffIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              id="presales-verify-panel-title"
              className="text-[13px] font-semibold text-[var(--crm-text-primary)]"
            >
              {title}
            </h3>
            <span className="rounded-full bg-[var(--crm-success-bg)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--crm-success-text)]">
              Handoff
            </span>
            {handoffLabel?.trim() ? (
              <span className="truncate text-[10px] text-[var(--crm-text-muted)]">
                · {handoffLabel.trim()}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--crm-text-muted)]">
            Pincode required · sales exec optional · moves to{" "}
            <span className="text-[var(--crm-text-secondary)]">
              Data Conversion → Won → Assigned
            </span>
          </p>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div
          className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[var(--crm-text-muted)]"
          aria-hidden="true"
        >
          {["Pincode", "Assign", "Note & verify"].map((label, i) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              {i > 0 ? (
                <span className="text-[var(--crm-border-strong)]">›</span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] px-1.5 py-0.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--crm-accent-soft)] text-[9px] font-bold text-[var(--crm-accent)]">
                  {i + 1}
                </span>
                {label}
              </span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          <div className="flex min-w-0 flex-col">
            <div className="mb-1 flex min-h-[28px] flex-col justify-end">
              <FieldLabel required>Pincode</FieldLabel>
            </div>
            <Input
              value={pincode}
              onChange={(e) => onPincodeChange(e.target.value)}
              placeholder="e.g. 560001"
              missing={showErrors && pincodeMissing}
              className="h-[38px] rounded-[10px] bg-[var(--crm-input-bg)] text-[13px]"
            />
            <p
              className={[
                "mt-1 text-[10px] leading-tight",
                FIELD_FOOTER_MIN_H,
                showErrors && pincodeMissing
                  ? "font-medium text-[var(--crm-danger-text)]"
                  : "text-[var(--crm-text-muted)]",
              ].join(" ")}
            >
              {showErrors && pincodeMissing
                ? "Required for verify."
                : "Property / service area pincode."}
            </p>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="mb-1 flex min-h-[28px] flex-col justify-end">
              <FieldLabel>
                Sales executive{" "}
                <span className="font-normal text-[var(--crm-text-muted)]">
                  (optional)
                </span>
              </FieldLabel>
            </div>
            <Select
              value={salesExecutiveId}
              onChange={(e) => onSalesExecutiveIdChange(e.target.value)}
              disabled={salesExecutivesLoading}
              className="h-[38px] rounded-[10px] py-2 text-[13px]"
            >
              <option value="">No assignment</option>
              {salesExecutiveOptions.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {salesExecutiveLabel(u)}
                </option>
              ))}
            </Select>
            <p
              className={[
                "mt-1 text-[10px] leading-tight",
                FIELD_FOOTER_MIN_H,
                salesFooterMessage && !salesExecutivesLoading
                  ? "text-[var(--crm-warning-text)]"
                  : "text-[var(--crm-text-muted)]",
              ].join(" ")}
            >
              {salesFooterMessage || "\u00a0"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

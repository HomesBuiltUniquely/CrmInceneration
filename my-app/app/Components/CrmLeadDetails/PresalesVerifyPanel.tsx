"use client";

import { FieldLabel, Input } from "./ui";

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
};

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
}: Props) {
  return (
    <div className="rounded-[14px] border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div>
        <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-100">
          Verify & hand off to sales
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-200/80">
          Pincode is required. Optionally assign a sales executive. Saving will
          verify this lead and set milestone to Data Conversion / Won / Assigned.
        </p>
      </div>
      <div>
        <FieldLabel required>Pincode</FieldLabel>
        <Input
          value={pincode}
          onChange={(e) => onPincodeChange(e.target.value)}
          placeholder="Enter pincode"
          className={[
            "h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]",
            showErrors && pincodeMissing ? "border-red-500 bg-red-100" : "",
          ].join(" ")}
        />
        {showErrors && pincodeMissing ? (
          <p className="mt-1 text-[12px] text-red-500">Pincode is required.</p>
        ) : null}
      </div>
      <div>
        <FieldLabel>Sales Executive (optional)</FieldLabel>
        <div className="relative mt-0">
          <select
            value={salesExecutiveId}
            onChange={(e) => onSalesExecutiveIdChange(e.target.value)}
            className="h-[42px] w-full appearance-none rounded-[12px] border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 pr-9 text-[14px] outline-none focus:border-[var(--crm-accent)]"
            disabled={salesExecutivesLoading}
          >
            <option value="">— No assignment —</option>
            {salesExecutiveOptions.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {salesExecutiveLabel(u)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--crm-text-muted)]">
            ▾
          </span>
        </div>
        {salesExecutivesLoading ? (
          <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
            Loading sales executives…
          </p>
        ) : salesExecutivesError ? (
          <p className="mt-1 text-[11px] text-amber-700">{salesExecutivesError}</p>
        ) : salesExecutiveOptions.length === 0 ? (
          <p className="mt-1 text-[11px] text-amber-700">
            Could not load the list. You can still verify with pincode only.
          </p>
        ) : null}
      </div>
    </div>
  );
}

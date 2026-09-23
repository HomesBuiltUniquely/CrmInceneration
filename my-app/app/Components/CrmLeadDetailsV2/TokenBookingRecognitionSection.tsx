"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  fetchBookingDoneRecords,
  saveBookingTokenRecognition,
  type BookingTokenRecognitionInput,
  type BookingTokenRecord,
} from "@/lib/booking-done-api";

type Props = {
  leadType: CrmLeadType | string;
  leadId: string;
  /** Compact layout inside Booking Done modal */
  compact?: boolean;
  onSaved?: (record: BookingTokenRecord) => void;
};

type FormState = {
  tokenTakenDate: string;
  tokenPaidDate: string;
  tokenAmountPaid: string;
  quoteAmount: string;
  tenPercentAmount: string;
  amountReceived: string;
  bookingDoneDate: string;
  tenPercentPaidDate: string;
  listingType: "" | "token" | "booking";
};

const EMPTY_FORM: FormState = {
  tokenTakenDate: "",
  tokenPaidDate: "",
  tokenAmountPaid: "",
  quoteAmount: "",
  tenPercentAmount: "",
  amountReceived: "",
  bookingDoneDate: "",
  tenPercentPaidDate: "",
  listingType: "",
};

function asDateInput(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  // Hub returns YYYY-MM-DD; tolerate ISO datetime prefixes.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : "";
}

function asAmountInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "";
  return String(value);
}

function formFromRecord(record: BookingTokenRecord | null | undefined): FormState {
  if (!record) return { ...EMPTY_FORM };
  const listing =
    record.listingType?.trim().toLowerCase() === "booking"
      ? "booking"
      : record.listingType?.trim().toLowerCase() === "token"
        ? "token"
        : "";
  return {
    tokenTakenDate: asDateInput(record.tokenTakenDate),
    tokenPaidDate: asDateInput(record.tokenPaidDate),
    tokenAmountPaid: asAmountInput(record.tokenAmountPaid),
    quoteAmount: asAmountInput(record.quoteAmount),
    tenPercentAmount: asAmountInput(record.tenPercentAmount),
    amountReceived: asAmountInput(record.amountReceived),
    bookingDoneDate: asDateInput(record.bookingDoneDate),
    tenPercentPaidDate: asDateInput(record.tenPercentPaidDate),
    listingType: listing,
  };
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function toRecognitionInput(form: FormState): BookingTokenRecognitionInput {
  return {
    tokenTakenDate: form.tokenTakenDate.trim() || undefined,
    tokenPaidDate: form.tokenPaidDate.trim() || undefined,
    tokenAmountPaid: parseOptionalNumber(form.tokenAmountPaid),
    quoteAmount: parseOptionalNumber(form.quoteAmount),
    tenPercentAmount: parseOptionalNumber(form.tenPercentAmount),
    amountReceived: parseOptionalNumber(form.amountReceived),
    bookingDoneDate: form.bookingDoneDate.trim() || undefined,
    tenPercentPaidDate: form.tenPercentPaidDate.trim() || undefined,
    listingType: form.listingType || undefined,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#d6dce6] bg-white px-3 py-2 text-[13px] text-[#0f172a] outline-none transition focus:border-[#86efac] focus:ring-2 focus:ring-[#bbf7d0] disabled:opacity-60";

export default function TokenBookingRecognitionSection({
  leadType,
  leadId,
  compact = false,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(compact);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchBookingDoneRecords(leadType as CrmLeadType, leadId);
      const record = res.records?.[0] ?? null;
      setRecordId(record?.id ?? null);
      setForm(formFromRecord(record));
    } catch (e) {
      // No deal yet is fine — empty form; Hub creates on save if needed.
      setRecordId(null);
      setForm({ ...EMPTY_FORM });
      const msg = e instanceof Error ? e.message : "";
      if (msg && !/unable to load booking records/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId, leadType]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = toRecognitionInput(form);
      if (Object.keys(payload).length === 0) {
        setError("Enter at least one date, amount, or listing type.");
        return;
      }
      const saved = await saveBookingTokenRecognition(
        leadType as CrmLeadType,
        leadId,
        payload,
      );
      setRecordId(saved.id ?? recordId);
      setForm(formFromRecord(saved));
      setSuccess(
        saved.created
          ? "Saved — Booking & Token deal created with recognition dates."
          : "Saved recognition dates.",
      );
      onSaved?.(saved);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save token/booking recognition dates.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={`rounded-lg border border-[#e2e8f0] bg-[#f8fafc] ${
        compact ? "mt-4 p-4" : "mt-3 p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#0f172a]">
            Token &amp; booking dates (old leads)
          </p>
          <p className="mt-1 max-w-2xl text-[13px] text-[#64748b]">
            Optional. New bookings can skip this. Fill for old projects so they appear on
            the real token/booking day and incentives use those dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 rounded-full border border-[#d6dce6] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#475569] transition hover:bg-[#f1f5f9]"
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed ? (
        <div className="mt-4">
          {loading ? (
            <p className="text-[13px] text-[#64748b]">Loading current values…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Token taken date">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.tokenTakenDate}
                    onChange={(e) => patch("tokenTakenDate", e.target.value)}
                    disabled={saving}
                  />
                </Field>
                <Field label="Token paid date">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.tokenPaidDate}
                    onChange={(e) => patch("tokenPaidDate", e.target.value)}
                    disabled={saving}
                  />
                </Field>
                <Field label="Token amount paid (₹)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={form.tokenAmountPaid}
                    onChange={(e) => patch("tokenAmountPaid", e.target.value)}
                    disabled={saving}
                    placeholder="0"
                  />
                </Field>
                <Field label="Quotation value (₹)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={form.quoteAmount}
                    onChange={(e) => patch("quoteAmount", e.target.value)}
                    disabled={saving}
                    placeholder="0"
                  />
                </Field>
                <Field label="10% amount that should be paid (₹)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={form.tenPercentAmount}
                    onChange={(e) => patch("tenPercentAmount", e.target.value)}
                    disabled={saving}
                    placeholder="0"
                  />
                </Field>
                <Field label="Amount collected toward 10% (₹)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={form.amountReceived}
                    onChange={(e) => patch("amountReceived", e.target.value)}
                    disabled={saving}
                    placeholder="0"
                  />
                </Field>
                <Field label="Full 10% / booking done date">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.bookingDoneDate}
                    onChange={(e) => patch("bookingDoneDate", e.target.value)}
                    disabled={saving}
                  />
                </Field>
                <Field label="10% paid date">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.tenPercentPaidDate}
                    onChange={(e) => patch("tenPercentPaidDate", e.target.value)}
                    disabled={saving}
                  />
                </Field>
                <Field label="Show as">
                  <select
                    className={inputClass}
                    value={form.listingType}
                    onChange={(e) =>
                      patch(
                        "listingType",
                        e.target.value as FormState["listingType"],
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">Select tab</option>
                    <option value="token">Token</option>
                    <option value="booking">Booking</option>
                  </select>
                </Field>
              </div>

              <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-[#64748b]">
                <li>Token tab uses token taken date</li>
                <li>Booking tab uses booking done (full 10%) date</li>
                <li>If 10% amount is empty on create, Hub can use quote × 0.10</li>
              </ul>

              {recordId ? (
                <p className="mt-2 text-[11px] text-[#94a3b8]">Deal id: {recordId}</p>
              ) : (
                <p className="mt-2 text-[11px] text-[#94a3b8]">
                  No deal yet — save creates one when quote amount is provided.
                </p>
              )}

              {error ? (
                <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-2 text-[13px] text-[#047857]">
                  {success}
                </p>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={saving || loading}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d6dce6] bg-white px-3 text-[12px] font-semibold text-[#475569] disabled:opacity-60"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || loading}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#16a34a] px-4 text-[12px] font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save dates"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

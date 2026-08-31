"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatPaymentAmountInput,
  parsePaymentAmountInput,
} from "@/lib/booking-done-payment-storage";
import { formatQuoteAmount } from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import {
  isActivePaymentLinkStatus,
  isSmsFallback,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";

type Props = {
  attempt: PaymentLinkAttempt;
  busy?: boolean;
  onCopy: () => void;
  onResend: () => void;
  onEdit: (amount: number) => void;
  onSwitchOffline: () => void;
};

function formatRelativePast(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRemaining(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  if (diff <= 0) return "Expired";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `Expires in ${hours}h ${rest}m` : `Expires in ${hours}h`;
}

function channelGlyph(status?: string | null): string {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "SENT") return "✓";
  if (normalized === "FAILED") return "✕";
  return "—";
}

function expiryUrgency(expiresAt?: string | null): "ok" | "amber" | "red" {
  if (!expiresAt) return "ok";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "red";
  if (diff <= 30 * 60_000) return "red";
  if (diff <= 2 * 60 * 60_000) return "amber";
  return "ok";
}

function expiryProgress(createdAt?: string | null, expiresAt?: string | null): number {
  if (!createdAt || !expiresAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

export default function PaymentLinkPendingBanner({
  attempt,
  busy = false,
  onCopy,
  onResend,
  onEdit,
  onSwitchOffline,
}: Props) {
  const [, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(formatPaymentAmountInput(attempt.amount));

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setEditAmount(formatPaymentAmountInput(attempt.amount));
    setEditing(false);
  }, [attempt.id, attempt.amount]);

  const sentAgo = formatRelativePast(attempt.createdAt);
  const expiresLabel = formatRemaining(attempt.expiresAt);
  const urgency = expiryUrgency(attempt.expiresAt);
  const progress = expiryProgress(attempt.createdAt, attempt.expiresAt);
  const notDelivered = String(attempt.status).toUpperCase() === "CREATED_NOT_DELIVERED";
  const smsFallback = isSmsFallback(attempt);
  const wa = channelGlyph(attempt.whatsappStatus);
  const email = channelGlyph(attempt.emailStatus);
  const sms = channelGlyph(attempt.smsStatus);
  const createdLocal = formatCrmDateTime(attempt.createdAt ?? "");
  const expiresLocal = formatCrmDateTime(attempt.expiresAt ?? "");

  const counts = useMemo(() => {
    const parts = [
      `Sent ${attempt.sendCount ?? 1}×`,
      (attempt.copyCount ?? 0) > 0 ? `Copied ${attempt.copyCount}×` : null,
      (attempt.resendCount ?? 0) > 0 ? `Resent ${attempt.resendCount}×` : null,
      (attempt.editCount ?? 0) > 0 ? `Edited ${attempt.editCount}×` : null,
      attempt.salesUserName ? `by ${attempt.salesUserName}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [attempt]);

  const barClass =
    urgency === "red"
      ? "bg-red-500"
      : urgency === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const wrapClass =
    urgency === "red"
      ? "border-red-200 bg-red-50"
      : urgency === "amber"
        ? "border-amber-200 bg-amber-50"
        : notDelivered
          ? "border-amber-200 bg-amber-50"
          : "border-sky-200 bg-sky-50";

  const handleSaveEdit = () => {
    const amount = parsePaymentAmountInput(editAmount);
    if (amount == null || amount <= 0) return;
    onEdit(amount);
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${wrapClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#111827]">
            Payment Link — {formatQuoteAmount(attempt.amount)} · Online (UPI/Card/Netbanking)
          </p>
          <p className="mt-1 text-[11px] text-[#4b5563]">
            Sent: <span className="font-semibold">WA {wa}</span>
            <span className="ml-1 font-semibold">Email {email}</span>
            <span className="ml-1 font-semibold">SMS {sms}</span>
          </p>
        </div>
        {isActivePaymentLinkStatus(attempt.status) ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={onCopy}
              className="rounded-md border border-[#d1d5db] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onResend}
              className="rounded-md border border-[#d1d5db] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
            >
              Resend
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing((open) => !open)}
              className="rounded-md border border-[#d1d5db] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
            >
              Edit
            </button>
          </div>
        ) : null}
      </div>

      {smsFallback ? (
        <p className="mt-2 rounded-md border border-sky-200 bg-white/70 px-2.5 py-1.5 text-[12px] text-sky-900">
          WhatsApp failed — SMS sent as fallback.
        </p>
      ) : null}

      {notDelivered ? (
        <p className="mt-2 rounded-md border border-amber-300 bg-white/70 px-2.5 py-1.5 text-[12px] text-amber-900">
          Link created, messages failed — copy the URL and share it manually.
        </p>
      ) : null}

      {attempt.warnings && attempt.warnings.length > 0 ? (
        <p className="mt-2 text-[11px] text-amber-800">{attempt.warnings.join(" · ")}</p>
      ) : null}

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
          <span title={createdLocal && createdLocal !== "—" ? createdLocal : undefined}>
            {sentAgo ? `Sent ${sentAgo}` : "Sent"}
          </span>
          <span
            title={expiresLocal && expiresLocal !== "—" ? expiresLocal : undefined}
            className={urgency === "ok" ? "text-[#6b7280]" : urgency === "amber" ? "text-amber-800" : "text-red-700"}
          >
            {expiresLabel}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {counts ? <p className="mt-2 text-[11px] text-[#4b5563]">{counts}</p> : null}

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-[#374151]">₹</span>
          <input
            type="text"
            inputMode="numeric"
            value={editAmount}
            onChange={(event) => setEditAmount(event.target.value.replace(/[^\d,]/g, ""))}
            className="h-9 flex-1 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#bbf7d0]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveEdit}
            className="h-9 rounded-md bg-[#059669] px-3 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={onSwitchOffline}
        className="mt-3 text-[11px] font-semibold text-[#6b7280] underline-offset-2 hover:text-[#111827] hover:underline disabled:opacity-60"
      >
        Switch to Offline
      </button>
    </div>
  );
}

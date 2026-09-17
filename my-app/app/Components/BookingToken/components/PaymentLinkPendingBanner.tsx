"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  formatPaymentAmountInput,
  parsePaymentAmountInput,
} from "@/lib/booking-done-payment-storage";
import { formatQuoteAmount } from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import {
  attemptHasPaymentFailures,
  attemptPaymentFailureCount,
  formatPaymentFailureStatusLabel,
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
  onDelete?: () => void;
};

function formatRelativePast(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatExpiryRemaining(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  if (diff <= 0) return "Expired";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function channelWasUsed(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === "SENT";
}

function expiryProgress(createdAt?: string | null, expiresAt?: string | null): number {
  if (!createdAt || !expiresAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

function IconActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-[25px] w-[25px] items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-px hover:border-[#2563eb] hover:bg-[#2563eb] hover:text-white active:scale-[0.93] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
    >
      {children}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ResendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChannelChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"
    >
      {children}
    </span>
  );
}

export default function PaymentLinkPendingBanner({
  attempt,
  busy = false,
  onCopy,
  onResend,
  onEdit,
  onSwitchOffline,
  onDelete,
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

  const sentTime = formatRelativePast(attempt.createdAt);
  const expiryRemaining = formatExpiryRemaining(attempt.expiresAt);
  const isExpired = expiryRemaining === "Expired";
  const progress = expiryProgress(attempt.createdAt, attempt.expiresAt);
  const notDelivered = String(attempt.status).toUpperCase() === "CREATED_NOT_DELIVERED";
  const smsFallback = isSmsFallback(attempt);
  const showWhatsApp = channelWasUsed(attempt.whatsappStatus);
  const showEmail = channelWasUsed(attempt.emailStatus);
  const createdLocal = formatCrmDateTime(attempt.createdAt ?? "");
  const expiresLocal = formatCrmDateTime(attempt.expiresAt ?? "");
  const amountLabel = formatQuoteAmount(attempt.amount);
  const showChannels = showWhatsApp || showEmail;

  const sendCount = attempt.sendCount ?? 1;
  const copyCount = attempt.copyCount ?? 0;
  const failureCount = attemptPaymentFailureCount(attempt);
  const showFailureStrip = attemptHasPaymentFailures(attempt);
  const lastFailureStatus = formatPaymentFailureStatusLabel(attempt.lastPaymentFailureStatus);
  const lastFailureReason = attempt.lastPaymentFailureReason?.trim() ?? "";
  const lastFailureLine = [lastFailureStatus, lastFailureReason].filter(Boolean).join(" · ");

  const handleSaveEdit = () => {
    const amount = parsePaymentAmountInput(editAmount);
    if (amount == null || amount <= 0) return;
    onEdit(amount);
  };

  return (
    <div className="space-y-1.5">
      <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5 transition-shadow hover:border-slate-300 hover:shadow-[0_3px_10px_-6px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="min-w-0 truncate text-[13px] font-semibold text-slate-900" title={`Payment Link — ${amountLabel} · Online (UPI/Card/Netbanking)`}>
            <span className="font-normal text-slate-900">Payment Link — </span>
            <span className="font-semibold text-[#2563eb]">{amountLabel}</span>
            <span className="font-normal text-slate-900"> · Online (UPI/Card/Netbanking)</span>
          </p>
          {showChannels ? (
            <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2">
              {showWhatsApp ? (
                <ChannelChip label="Sent via WhatsApp">
                  <WhatsAppIcon />
                </ChannelChip>
              ) : null}
              {showEmail ? (
                <ChannelChip label="Sent via Email">
                  <EmailIcon />
                </ChannelChip>
              ) : null}
            </div>
          ) : null}
        </div>
        {isActivePaymentLinkStatus(attempt.status) ? (
          <div className="flex shrink-0 items-center gap-1">
            <IconActionButton label="Copy payment link" disabled={busy} onClick={onCopy}>
              <CopyIcon />
            </IconActionButton>
            <IconActionButton
              label="Resend payment link"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Resend payment link with same amount?")) return;
                onResend();
              }}
            >
              <ResendIcon />
            </IconActionButton>
            <IconActionButton
              label="Edit payment amount"
              disabled={busy}
              onClick={() => setEditing((open) => !open)}
            >
              <EditIcon />
            </IconActionButton>
            {onDelete ? (
              <IconActionButton
                label="Delete payment link"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this payment link? Customer will no longer be able to pay with it. You can send a new link after deleting.",
                    )
                  ) {
                    return;
                  }
                  onDelete();
                }}
              >
                <DeleteIcon />
              </IconActionButton>
            ) : null}
          </div>
        ) : null}
      </div>

      {smsFallback ? (
        <p className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-600">
          WhatsApp failed — SMS sent as fallback.
        </p>
      ) : null}

      {notDelivered ? (
        <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-800">
          Link created, messages failed — copy the URL and share it manually.
        </p>
      ) : null}

      {attempt.warnings && attempt.warnings.length > 0 ? (
        <p className="mt-1.5 text-[10.5px] font-semibold text-amber-700">{attempt.warnings.join(" · ")}</p>
      ) : null}

      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="shrink-0 text-[10.5px] font-semibold text-slate-500"
          title={createdLocal && createdLocal !== "—" ? createdLocal : undefined}
        >
          {sentTime === "just now" ? (
            <>
              Sent <span className="text-slate-700">just now</span>
            </>
          ) : sentTime ? (
            <>
              Sent <span className="text-slate-700">{sentTime}</span> ago
            </>
          ) : (
            "Sent"
          )}
        </span>
        <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${isExpired ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span
          className={`shrink-0 text-[10.5px] font-semibold ${isExpired ? "text-red-600" : "text-amber-600"}`}
          title={expiresLocal && expiresLocal !== "—" ? expiresLocal : undefined}
        >
          {isExpired ? "Expired" : `Expires in ${expiryRemaining}`}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5">
        <p className="min-w-0 text-[10.5px] font-semibold text-slate-500">
          <span className="font-semibold text-slate-700">{sendCount}</span> sent
          {copyCount > 0 ? (
            <>
              {" "}
              · <span className="font-semibold text-slate-700">{copyCount}</span> copied
            </>
          ) : null}
          {attempt.salesUserName ? <> · by {attempt.salesUserName}</> : null}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {onDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Delete this payment link? Customer will no longer be able to pay with it. You can send a new link after deleting.",
                  )
                ) {
                  return;
                }
                onDelete();
              }}
              className="text-[10.5px] font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Delete link
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onSwitchOffline}
            className="text-[10.5px] font-semibold text-[#2563eb] underline-offset-2 hover:underline disabled:opacity-60"
          >
            Switch to offline
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-1.5 flex items-center gap-2 border-t border-slate-200 pt-1.5">
          <span className="text-[13px] font-semibold text-slate-700">₹</span>
          <input
            type="text"
            inputMode="numeric"
            value={editAmount}
            onChange={(event) => setEditAmount(event.target.value.replace(/[^\d,]/g, ""))}
            className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveEdit}
            className="h-8 rounded-md bg-emerald-600 px-3 text-[10.5px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
    {showFailureStrip ? (
      <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2">
        <p className="text-[12px] font-semibold text-amber-950">
          Customer payment failed {Math.max(1, failureCount)}×
        </p>
        {lastFailureLine ? (
          <p className="mt-0.5 text-[11px] font-medium text-amber-900">Last: {lastFailureLine}</p>
        ) : null}
        <p className="mt-0.5 text-[10.5px] font-semibold text-amber-800">
          Link is still open — customer can retry
        </p>
      </div>
    ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./ui";
import type { ActivityItem, ActivityType } from "@/lib/data";
import {
  classifyPaymentActivityBucket,
  detectPaymentReceivedKind,
  formatBookingPaymentActivityTitle,
  isBookingPaymentActivityType,
  isBookingPaymentFailedActivity,
  isBookingPaymentStageActivity,
  isOnlinePaymentReceivedActivity,
  paymentReceivedHeadline,
  paymentStageHeadline,
  pickPaymentReceivedMotivateLine,
} from "@/lib/booking-payment-activity";
import { isQuoteSentActivityText, pickQuoteSentMotivateLine } from "@/lib/quote-sent-motivate";

const typeConfig: Record<
  ActivityType,
  { label: string; dotClass: string; labelClass: string; icon: string }
> = {
  assignment: {
    label: "Assignment",
    icon: "👤",
    dotClass: "border-blue-400/30 bg-blue-500/10 text-blue-300",
    labelClass: "text-blue-300",
  },
  note: {
    label: "Note",
    icon: "📝",
    dotClass: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    labelClass: "text-amber-300",
  },
  call: {
    label: "Call",
    icon: "📞",
    dotClass: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    labelClass: "text-cyan-300",
  },
  update: {
    label: "Update",
    icon: "🔄",
    dotClass: "border-violet-400/30 bg-violet-500/10 text-violet-300",
    labelClass: "text-violet-300",
  },
  status: {
    label: "Status",
    icon: "⚡",
    dotClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    labelClass: "text-emerald-300",
  },
  design_qa_invite: {
    label: "Design QA",
    icon: "✉️",
    dotClass: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    labelClass: "text-sky-300",
  },
  design_qa_submitted: {
    label: "QA Submit",
    icon: "✅",
    dotClass: "border-teal-400/30 bg-teal-500/10 text-teal-300",
    labelClass: "text-teal-300",
  },
  quote_sent_to_customer: {
    label: "Quote Sent",
    icon: "⭐",
    dotClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    labelClass: "text-emerald-300",
  },
  booking_token: {
    label: "Booking & Token",
    icon: "🏷️",
    dotClass: "border-orange-400/30 bg-orange-500/10 text-orange-300",
    labelClass: "text-orange-300",
  },
  payment: {
    label: "Payments",
    icon: "₹",
    dotClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    labelClass: "text-emerald-300",
  },
};

type ActivityFilter = "all" | ActivityType;

const FILTER_ORDER: ActivityFilter[] = [
  "all",
  "call",
  "note",
  "assignment",
  "status",
  "update",
  "booking_token",
  "payment",
  "design_qa_invite",
  "design_qa_submitted",
  "quote_sent_to_customer",
];

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All",
  call: "Calls",
  note: "Notes",
  assignment: "Assignments",
  status: "Status",
  update: "Updates",
  booking_token: "Booking & Token",
  payment: "Payments",
  design_qa_invite: "Design QA",
  design_qa_submitted: "QA Submit",
  quote_sent_to_customer: "Quote Sent",
};

function ActivityDetail({ item }: { item: ActivityItem }) {
  const cfg = typeConfig[item.type];
  const isQuoteSent =
    item.type === "quote_sent_to_customer" ||
    isQuoteSentActivityText(item.rawActivityType, item.description, item.note);
  const isPayFail = isBookingPaymentFailedActivity(item.rawActivityType);
  const isPayStage = isBookingPaymentStageActivity(
    item.rawActivityType,
    item.description,
    item.note,
    item.change?.new,
  );
  const isPayReceived = isOnlinePaymentReceivedActivity(
    item.rawActivityType,
    item.description,
    item.note,
    item.change?.new,
  );
  const paymentKind =
    isPayReceived || isPayStage
      ? detectPaymentReceivedKind(
          item.rawActivityType,
          item.description,
          item.note,
          item.change?.new,
          item.change?.old,
        )
      : undefined;
  const motivateLine = isQuoteSent
    ? pickQuoteSentMotivateLine(item.id)
    : (isPayReceived || isPayStage) && paymentKind
      ? pickPaymentReceivedMotivateLine(paymentKind, item.id)
      : null;
  const headline = isQuoteSent
    ? "Quote Sent to Customer"
    : isPayFail
      ? formatBookingPaymentActivityTitle(item.rawActivityType, item.description)
      : isPayStage && paymentKind
        ? paymentStageHeadline(paymentKind)
        : isPayReceived && paymentKind
          ? paymentReceivedHeadline(paymentKind)
          : isBookingPaymentActivityType(item.rawActivityType)
            ? formatBookingPaymentActivityTitle(item.rawActivityType, item.description)
            : cfg.label;
  const badgeTone = isQuoteSent
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
    : isPayFail
      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
      : isPayReceived || isPayStage
        ? paymentKind === "booking"
          ? "border-violet-400/30 bg-violet-500/10 text-violet-300"
          : "border-amber-400/30 bg-amber-500/10 text-amber-300"
        : `${cfg.dotClass} ${cfg.labelClass}`;
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.6px]",
            badgeTone,
          )}
        >
          <span>
            {isQuoteSent
              ? "⭐"
              : isPayFail
                ? "!"
                : isPayReceived || isPayStage
                  ? paymentKind === "booking"
                    ? "B"
                    : "T"
                  : cfg.icon}
          </span>
          {headline}
        </span>
        <span className="font-mono text-[11px] text-[var(--crm-text-muted)]">{item.timestamp}</span>
      </div>
      <p className="mb-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--crm-text-primary)] [overflow-wrap:anywhere]">
        {isPayReceived && paymentKind
          ? paymentReceivedHeadline(paymentKind)
          : isPayStage && paymentKind
            ? paymentStageHeadline(paymentKind)
            : item.description}
      </p>
      {motivateLine ? (
        <div
          className={cn(
            "mb-2 rounded-lg border px-3 py-2.5",
            isQuoteSent
              ? "border-emerald-500/20 bg-emerald-500/10"
              : paymentKind === "booking"
                ? "border-violet-500/20 bg-violet-500/10"
                : "border-amber-500/20 bg-amber-500/10",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.1em]",
              isQuoteSent
                ? "text-emerald-300"
                : paymentKind === "booking"
                  ? "text-violet-300"
                  : "text-amber-300",
            )}
          >
            {isQuoteSent
              ? "Keep going"
              : paymentKind === "booking"
                ? "Booking secured"
                : "Token locked in"}
          </p>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[var(--crm-text-primary)]">
            {motivateLine}
          </p>
        </div>
      ) : null}
      {item.note ? (
        <div className="mb-2 min-w-0 whitespace-pre-wrap break-words rounded-lg border border-[var(--crm-border)] border-l-[3px] border-l-amber-400 bg-[var(--crm-surface-subtle)] p-3 font-mono text-[12px] leading-relaxed text-[var(--crm-text-muted)] [overflow-wrap:anywhere]">
          {item.note}
        </div>
      ) : null}
      {item.change ? (
        <div className="mb-2 flex min-w-0 w-full flex-col gap-2 overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 font-mono text-[12px]">
          <span className="whitespace-pre-wrap break-words text-rose-500 line-through opacity-70 [overflow-wrap:anywhere]">
            {item.change.old}
          </span>
          <span className="self-start text-[var(--crm-text-muted)]">→</span>
          <span className="whitespace-pre-wrap break-words text-emerald-600 [overflow-wrap:anywhere]">
            {item.change.new}
          </span>
        </div>
      ) : null}
      <p className="flex items-center gap-1 text-[11px] text-[var(--crm-text-muted)]">
        <span>👤</span> By: {item.by}
      </p>
    </div>
  );
}

function ActivityListRow({
  item,
  selected,
  onSelect,
}: {
  item: ActivityItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const cfg = typeConfig[item.type];
  const isQuoteSent =
    item.type === "quote_sent_to_customer" ||
    isQuoteSentActivityText(item.rawActivityType, item.description, item.note);
  const isPayFail = isBookingPaymentFailedActivity(item.rawActivityType);
  const isPayStage = isBookingPaymentStageActivity(
    item.rawActivityType,
    item.description,
    item.note,
    item.change?.new,
  );
  const isPayReceived = isOnlinePaymentReceivedActivity(
    item.rawActivityType,
    item.description,
    item.note,
    item.change?.new,
  );
  const paymentKind =
    isPayReceived || isPayStage
      ? detectPaymentReceivedKind(
          item.rawActivityType,
          item.description,
          item.note,
          item.change?.new,
          item.change?.old,
        )
      : undefined;
  const motivateLine =
    isQuoteSent
      ? pickQuoteSentMotivateLine(item.id)
      : (isPayReceived || isPayStage) && paymentKind
        ? pickPaymentReceivedMotivateLine(paymentKind, item.id)
        : null;
  const rowTitle = isQuoteSent
    ? "Quote Sent to Customer"
    : isPayFail
      ? formatBookingPaymentActivityTitle(item.rawActivityType, item.description)
      : isPayStage && paymentKind
        ? paymentStageHeadline(paymentKind)
        : isPayReceived && paymentKind
          ? paymentReceivedHeadline(paymentKind)
          : item.description;
  const rowClass = isQuoteSent
    ? selected
      ? "bg-emerald-500/20"
      : "hover:bg-emerald-500/10"
    : isPayFail
      ? selected
        ? "bg-rose-500/20"
        : "hover:bg-rose-500/10"
      : isPayReceived || isPayStage
        ? paymentKind === "booking"
          ? selected
            ? "bg-violet-500/20"
            : "hover:bg-violet-500/10"
          : selected
            ? "bg-amber-500/20"
            : "hover:bg-amber-500/10"
        : selected
          ? "bg-[var(--crm-accent-soft)]"
          : "hover:bg-[var(--crm-surface-subtle)]";
  const badgeClass = isQuoteSent
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
    : isPayFail
      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
      : isPayReceived || isPayStage
        ? paymentKind === "booking"
          ? "border-violet-400/30 bg-violet-500/10 text-violet-300"
          : "border-amber-400/30 bg-amber-500/10 text-amber-300"
        : cfg.dotClass;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 gap-3 border-b border-[var(--crm-border)] px-3 py-2.5 text-left transition-colors last:border-b-0",
        rowClass,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-sm",
          badgeClass,
        )}
      >
        {isQuoteSent
          ? "⭐"
          : isPayFail
            ? "!"
            : isPayReceived || isPayStage
              ? paymentKind === "booking"
                ? "B"
                : "T"
              : cfg.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.5px]",
              isQuoteSent
                ? "text-emerald-300"
                : isPayFail
                  ? "text-rose-300"
                  : isPayReceived || isPayStage
                    ? paymentKind === "booking"
                      ? "text-violet-300"
                      : "text-amber-300"
                    : cfg.labelClass,
            )}
          >
            {isQuoteSent
              ? "Quote Sent"
              : isPayFail
                ? "Payment failed"
                : isPayReceived || isPayStage
                  ? paymentKind === "booking"
                    ? "Booking payment"
                    : "Token payment"
                  : cfg.label}
          </span>
          <span className="flex-shrink-0 font-mono text-[10px] text-[var(--crm-text-muted)]">
            {item.timestamp}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-[var(--crm-text-primary)]">
          {rowTitle}
        </span>
        {motivateLine ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px] italic",
              isQuoteSent
                ? "text-emerald-300/90"
                : paymentKind === "booking"
                  ? "text-violet-300/90"
                  : "text-amber-300/90",
            )}
          >
            {motivateLine}
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-[11px] text-[var(--crm-text-muted)]">
            {item.by}
          </span>
        )}
      </span>
    </button>
  );
}

export default function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [paymentSubFilter, setPaymentSubFilter] = useState<"all" | "links" | "settlements">(
    "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const byType = {} as Record<ActivityType, number>;
    let paymentLinks = 0;
    let paymentSettlements = 0;
    for (const a of activities) {
      byType[a.type] = (byType[a.type] ?? 0) + 1;
      if (a.type === "payment" || isBookingPaymentActivityType(a.rawActivityType)) {
        const bucket = classifyPaymentActivityBucket(
          a.rawActivityType,
          a.description,
          a.note,
          a.change?.new,
        );
        if (bucket === "link") paymentLinks += 1;
        else paymentSettlements += 1;
      }
    }
    return {
      all: activities.length,
      ...byType,
      payment_links: paymentLinks,
      payment_settlements: paymentSettlements,
    };
  }, [activities]);

  const visibleFilters = useMemo(
    () =>
      FILTER_ORDER.filter((id) => {
        if (id === "all") return counts.all > 0;
        return (counts[id as ActivityType] ?? 0) > 0;
      }),
    [counts],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return activities;
    const typed = activities.filter((a) => a.type === filter);
    if (filter !== "payment") return typed;
    if (paymentSubFilter === "all") return typed;
    return typed.filter((a) => {
      const bucket = classifyPaymentActivityBucket(
        a.rawActivityType,
        a.description,
        a.note,
        a.change?.new,
      );
      return paymentSubFilter === "links" ? bucket === "link" : bucket === "settlement";
    });
  }, [activities, filter, paymentSubFilter]);

  const selected =
    filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((a) => a.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  if (!activities.length) {
    return (
      <div className="animate-fade-up delay-3">
        <Card className="!pt-5 !pb-5">
          <p className="text-[13px] text-[var(--crm-text-muted)]">No activity recorded yet.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up delay-3">
      <Card className="!pt-5 !pb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[var(--crm-text-muted)]">
          <span>📟</span> Activity History
          <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] text-blue-300">
            {activities.length} events
          </span>
        </div>

        {/* Type filter tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleFilters.map((tabId) => {
            const count =
              tabId === "all" ? counts.all : (counts[tabId as ActivityType] ?? 0);
            const active = filter === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => {
                  setFilter(tabId);
                  if (tabId === "payment") setPaymentSubFilter("all");
                }}
                className={cn(
                  "flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all",
                  active
                    ? "border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] shadow-sm"
                    : "text-[var(--crm-text-muted)] hover:bg-[var(--crm-surface)] hover:text-[var(--crm-text-primary)]",
                )}
              >
                {tabId !== "all" ? (
                  <span className="text-sm">{typeConfig[tabId as ActivityType].icon}</span>
                ) : null}
                <span>{FILTER_LABELS[tabId]}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                    active
                      ? "bg-[var(--crm-accent)]/15 text-[var(--crm-accent)]"
                      : "bg-[var(--crm-border)] text-[var(--crm-text-muted)]",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filter === "payment" ? (
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1">
            {(
              [
                ["all", "All payments", counts.payment ?? 0],
                ["links", "Links", counts.payment_links],
                ["settlements", "Received", counts.payment_settlements],
              ] as const
            ).map(([id, label, count]) => {
              const active = paymentSubFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentSubFilter(id)}
                  className={cn(
                    "flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all",
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-[var(--crm-text-muted)] hover:text-[var(--crm-text-primary)]",
                  )}
                >
                  <span>{label}</span>
                  <span className="font-mono text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="text-[13px] text-[var(--crm-text-muted)]">
            No {FILTER_LABELS[filter].toLowerCase()} in this lead&apos;s history.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,38%)]">
            {/* Compact list — many events visible at once */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)]">
              <div className="border-b border-[var(--crm-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
                {filtered.length} in{" "}
                {filter === "payment"
                  ? paymentSubFilter === "links"
                    ? "Payment links"
                    : paymentSubFilter === "settlements"
                      ? "Payments received"
                      : "Payments"
                  : FILTER_LABELS[filter]}
              </div>
              <div className="max-h-[min(52vh,420px)] overflow-y-auto">
                {filtered.map((item) => (
                  <ActivityListRow
                    key={item.id}
                    item={item}
                    selected={selected?.id === item.id}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            </div>

            {/* Detail panel — full content without stacking the whole timeline */}
            <div className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] lg:flex">
              <div className="border-b border-[var(--crm-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
                Event detail
              </div>
              <div className="max-h-[min(52vh,420px)] overflow-y-auto p-4">
                {selected ? <ActivityDetail item={selected} /> : null}
              </div>
            </div>

            {/* Mobile: show selected detail below the list */}
            {selected ? (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-4 lg:hidden">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
                  Event detail
                </p>
                <ActivityDetail item={selected} />
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

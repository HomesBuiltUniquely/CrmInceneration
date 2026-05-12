"use client";

import { cn } from "@/lib/cn";
import { Card } from "./ui";
import type { ActivityItem, ActivityType } from "@/lib/data";

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
    label: "Status Change",
    icon: "⚡",
    dotClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    labelClass: "text-emerald-300",
  },
  design_qa_invite: {
    label: "Design QA — invitation",
    icon: "✉️",
    dotClass: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    labelClass: "text-sky-300",
  },
  design_qa_submitted: {
    label: "Design QA — submitted",
    icon: "✅",
    dotClass: "border-teal-400/30 bg-teal-500/10 text-teal-300",
    labelClass: "text-teal-300",
  },
};

function ActivityCard({ item, isLast, delay }: { item: ActivityItem; isLast: boolean; delay: string }) {
  const cfg = typeConfig[item.type];
  return (
    <div className={cn("flex min-w-0 gap-4 animate-fade-up", delay)}>
      {/* Dot + connector */}
      <div className="flex flex-col items-center flex-shrink-0 w-8 pt-0.5">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 flex-shrink-0",
            cfg.dotClass
          )}
        >
          {cfg.icon}
        </div>
        {!isLast && <div className="mt-1.5 w-px flex-1 bg-[var(--crm-border)]" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
        {/* Meta row */}
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <span className={cn("text-[11px] font-bold tracking-[0.8px] uppercase", cfg.labelClass)}>
            {cfg.label}
          </span>
          <span className="break-words text-right font-mono text-[11px] text-[var(--crm-text-muted)] [overflow-wrap:anywhere]">
            {item.timestamp}
          </span>
        </div>

        {/* Description */}
        <p className="mb-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--crm-text-primary)] [overflow-wrap:anywhere]">
          {item.description}
        </p>

        {/* Note box */}
        {item.note && (
          <div className="mt-2 min-w-0 whitespace-pre-wrap break-words rounded-lg border border-[var(--crm-border)] border-l-[3px] border-l-amber-400 bg-[var(--crm-surface-subtle)] p-3 font-mono text-[12px] leading-relaxed text-[var(--crm-text-muted)] [overflow-wrap:anywhere]">
            {item.note}
          </div>
        )}

        {/* Change diff */}
        {item.change && (
          <div className="mt-2 flex min-w-0 w-full flex-col gap-2 overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 font-mono text-[12px]">
            <span className="whitespace-pre-wrap break-words text-rose-500 line-through opacity-70 [overflow-wrap:anywhere]">
              {item.change.old}
            </span>
            <span className="self-start text-[var(--crm-text-muted)]">→</span>
            <span className="whitespace-pre-wrap break-words text-emerald-600 [overflow-wrap:anywhere]">
              {item.change.new}
            </span>
          </div>
        )}

        {/* By */}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--crm-text-muted)]">
          <span>👤</span> By: {item.by}
        </p>
      </div>
    </div>
  );
}

export default function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const delays = ["delay-1", "delay-2", "delay-3", "delay-4", "delay-5"];
  return (
    <div className="animate-fade-up delay-3">
      <Card className="!pt-5 !pb-5">
        <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[var(--crm-text-muted)]">
          <span>📟</span> Activity History
          <span className="ml-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] text-blue-300">
            {activities.length} events
          </span>
        </div>
        <div>
          {activities.map((item, i) => (
            <ActivityCard
              key={item.id}
              item={item}
              isLast={i === activities.length - 1}
              delay={delays[i] ?? "delay-5"}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

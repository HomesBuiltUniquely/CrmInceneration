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
};

function ActivityCard({ item, isLast, delay }: { item: ActivityItem; isLast: boolean; delay: string }) {
  const cfg = typeConfig[item.type];
  return (
    <div className={cn("flex gap-4 animate-fade-up", delay)}>
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
        {!isLast && <div className="mt-1.5 w-px flex-1 bg-slate-200" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        {/* Meta row */}
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[11px] font-bold tracking-[0.8px] uppercase", cfg.labelClass)}>
            {cfg.label}
          </span>
          <span className="font-mono text-[11px] text-slate-400">{item.timestamp}</span>
        </div>

        {/* Description */}
        <p className="mb-1.5 text-[13.5px] leading-relaxed text-slate-900">
          {item.description}
        </p>

        {/* Note box */}
        {item.note && (
          <div className="mt-2 rounded-lg border border-slate-200 border-l-[3px] border-l-amber-400 bg-amber-50/40 p-3 font-mono text-[12px] leading-relaxed text-slate-600">
            {item.note}
          </div>
        )}

        {/* Change diff */}
        {item.change && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px]">
            <span className="text-rose-500 line-through opacity-70">{item.change.old}</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-600">{item.change.new}</span>
          </div>
        )}

        {/* By */}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
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
        <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-slate-500">
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

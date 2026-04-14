"use client";

import { cn } from "@/lib/cn";

export type TabId = "lead" | "additional" | "assignments" | "activity";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "lead", label: "Lead Information", icon: "👤" },
  { id: "additional", label: "Additional Info", icon: "📋" },
  { id: "assignments", label: "Assignments", icon: "🎯" },
  { id: "activity", label: "Activity History", icon: "📟" },
];

interface TabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export default function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className="mb-6 flex gap-1 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] animate-fade-up delay-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 text-[12.5px] font-semibold px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer",
            active === tab.id
              ? "border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] shadow-sm"
              : "text-[var(--crm-text-muted)] hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text-primary)]"
          )}
        >
          <span className="text-sm">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

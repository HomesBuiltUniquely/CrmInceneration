"use client";

import type { Lead } from "@/lib/data";

interface StatCard {
  icon: string;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}

export default function StatsRow({ lead }: { lead: Lead }) {
  const phone = lead.phone?.trim() || "—";

  const stats: StatCard[] = [
    {
      icon: "📍",
      label: "Property Pincode",
      value: lead.pincode,
      iconBg: "bg-[rgba(79,158,248,0.15)]",
      iconColor: "text-[#4f9ef8]",
    },
    {
      icon: "📞",
      label: "Phone Number",
      value: phone,
      iconBg: "bg-[rgba(247,127,75,0.15)]",
      iconColor: "text-[#f77f4b]",
    },
    {
      icon: "💰",
      label: "Budget",
      value: lead.budget || "Not set",
      iconBg: "bg-[rgba(56,217,169,0.15)]",
      iconColor: "text-[#38d9a9]",
    },
    {
      icon: "🏢",
      label: "Configuration",
      value: lead.configuration?.trim() ? lead.configuration : "Not set",
      iconBg: "bg-[rgba(167,139,250,0.15)]",
      iconColor: "text-[#a78bfa]",
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 animate-fade-up delay-2 md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-3.5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
        >
          <div className={`w-10 h-10 rounded-[9px] flex items-center justify-center text-base flex-shrink-0 ${s.iconBg} ${s.iconColor}`}>
            {s.icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold tracking-[-0.2px] text-[var(--crm-text-primary)]">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--crm-text-muted)]">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

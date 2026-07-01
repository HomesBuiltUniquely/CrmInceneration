"use client";

import type { Lead } from "@/lib/data";
import { resolveLeadPhoneDisplayForRole } from "@/lib/lead-display";
import { shouldMaskLeadPhoneForRole } from "@/lib/lead-contact-access";

interface StatCard {
  icon: string;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}

export default function StatsRow({
  lead,
  viewerRole = "",
}: {
  lead: Lead;
  viewerRole?: string;
}) {
  const phone = resolveLeadPhoneDisplayForRole(
    lead.phone ?? "",
    shouldMaskLeadPhoneForRole(viewerRole),
  );

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
    {
      icon: "🔑",
      label: "Possession",
      value: lead.possessionDate?.trim() ? lead.possessionDate : "Not set",
      iconBg: "bg-[rgba(244,114,182,0.15)]",
      iconColor: "text-[#f472b6]",
    },
  ];

  return (
    <div className="mb-5 flex w-full gap-2 animate-fade-up delay-2">
      {stats.map((s, i) => (
        <div
          key={i}
          className="flex-1 min-w-0 flex items-center gap-2 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2 py-2 shadow-[0_14px_30px_rgba(15,23,42,0.06)] overflow-hidden"
        >
          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[14px] flex-shrink-0 ${s.iconBg} ${s.iconColor}`}>
            {s.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-bold tracking-[-0.2px] text-[var(--crm-text-primary)]">
              {s.value}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[var(--crm-text-muted)]">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

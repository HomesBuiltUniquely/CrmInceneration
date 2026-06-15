"use client";

import type { ReactNode } from "react";
import type { Lead } from "@/lib/data";
import { LeadSourceTag } from "./ui";
import { maskLeadPhoneForDisplay } from "@/lib/lead-display";
import type { ActivityItem } from "@/lib/data";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

function ActivityHistorySidebarCard({
  activities,
  onOpen,
}: {
  activities: ActivityItem[];
  onOpen?: () => void;
}) {
  const count = activities.length;
  const latest = activities[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Activity History
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {count}
        </span>
      </div>
      {latest ? (
        <p className="mt-2 line-clamp-2 text-[12px] font-medium text-slate-800">
          {latest.description}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-slate-500">No activity yet</p>
      )}
      <p className="mt-2 text-[11px] font-semibold text-emerald-700">
        Click to open activity history →
      </p>
    </button>
  );
}

function SidebarCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] ${className}`}
    >
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 text-base opacity-80" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="text-[13px] font-medium text-slate-800">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function LeadDetailsSidebar({
  lead,
  onLogCall,
  onOpenActivityHistory,
}: {
  lead: Lead;
  onLogCall?: () => void | Promise<void>;
  onOpenActivityHistory?: () => void;
}) {
  const phone = maskLeadPhoneForDisplay(lead.phone ?? "");
  const altPhone = maskLeadPhoneForDisplay(lead.altPhone ?? "");
  const location =
    (lead.propertyLocation ?? "").trim() ||
    (lead.pincode ? `Pincode ${lead.pincode}` : "—");

  return (
    <>
      <SidebarCard title="">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-2xl font-bold text-slate-700 ring-4 ring-white shadow-md">
            {initials(lead.name)}
          </div>
          <h2 className="text-[18px] font-bold text-slate-900">{lead.name}</h2>
          {lead.verified ? (
            <span className="mt-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
              Verified Lead
            </span>
          ) : (
            <span className="mt-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">
              Active Lead
            </span>
          )}
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            #{lead.customerId || lead.leadId || lead.id}
          </p>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-2">
          <InfoRow icon="📞" label="Phone" value={phone} />
          {onLogCall ? (
            <button
              type="button"
              onClick={() => void onLogCall()}
              className="mb-2 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Log call & dial
            </button>
          ) : null}
          <InfoRow icon="✉️" label="Email" value={lead.email || "—"} />
          <InfoRow icon="📍" label="Location" value={location} />
          <div className="py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Lead Source
            </div>
            <div className="mt-1">
              <LeadSourceTag
                primary={lead.leadSource}
                extras={lead.additionalLeadSourcesList}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Assignments
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {initials(lead.assignee)}
              </div>
              <div>
                <div className="text-[10px] text-slate-500">CRM</div>
                <div className="text-[13px] font-semibold text-slate-800">{lead.assignee}</div>
              </div>
            </div>
            {lead.designerName?.trim() ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                  {initials(lead.designerName)}
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Designer</div>
                  <div className="text-[13px] font-semibold text-slate-800">
                    {lead.designerName}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SidebarCard>

      {altPhone ? (
        <SidebarCard title="Family Contact">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
              FC
            </div>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Alternate contact</div>
              <div className="text-[12px] text-slate-600">{altPhone}</div>
            </div>
          </div>
        </SidebarCard>
      ) : null}

      <ActivityHistorySidebarCard
        activities={lead.activities}
        onOpen={onOpenActivityHistory}
      />
    </>
  );
}

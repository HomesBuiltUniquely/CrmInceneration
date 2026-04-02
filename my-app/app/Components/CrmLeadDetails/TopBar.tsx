"use client";

import Link from "next/link";
import { Button } from "./ui";

export default function TopBar() {
  return (
    <div className="mb-8 flex items-center justify-between animate-fade-up">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f9ef8] to-[#38d9a9] text-lg shadow-[0_16px_28px_rgba(79,158,248,0.28)]">
          🏠
        </div>
        <div>
          <div className="text-[19px] font-bold tracking-[-0.3px] text-slate-900">
            HubInterior CRM
          </div>
          <div className="mt-px text-[11px] font-mono text-slate-500">
            Lead Management System
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <button className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-[11px] font-semibold text-violet-500 transition-all hover:bg-violet-100">
          ✦ Design Preferences
        </button>
        <Link
          href="/Leads"
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-slate-100 shadow-[0_2px_6px_rgba(15,23,42,0.16)] ring-1 ring-white/10 transition-all duration-150 hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-[0_6px_14px_rgba(15,23,42,0.18)] hover:ring-white/20 active:translate-y-0 active:shadow-[0_2px_6px_rgba(15,23,42,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <span className="text-sm leading-none">✕</span>
          Close
        </Link>
      </div>
    </div>
  );
}

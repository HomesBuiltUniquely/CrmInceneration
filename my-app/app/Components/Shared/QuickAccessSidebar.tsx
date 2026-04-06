"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type QuickAccessSubItem = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

export type QuickAccessParentItem = {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  badge?: string;
  items: QuickAccessSubItem[];
};

type SelectionPayload = {
  parent: QuickAccessParentItem;
  subItem: QuickAccessSubItem;
};

interface QuickAccessSidebarProps {
  appBadge: string;
  appName: string;
  appTagline: string;
  sections: QuickAccessParentItem[];
  profileName: string;
  profileRole: string;
  profileInitials: string;
  logoutLabel?: string;
  onSelectionChange?: (selection: SelectionPayload) => void;
}

export default function QuickAccessSidebar({
  appBadge,
  appName,
  appTagline,
  sections,
  profileName,
  profileRole,
  profileInitials,
  logoutLabel = "Logout",
  onSelectionChange,
}: QuickAccessSidebarProps) {
  const initialParentId = sections[0]?.id ?? "";
  const [openParentId, setOpenParentId] = useState(initialParentId);
  const [activeSubItemId, setActiveSubItemId] = useState(sections[0]?.items[0]?.id ?? "");

  const openParent = useMemo(
    () => sections.find((section) => section.id === openParentId) ?? sections[0],
    [openParentId, sections],
  );

  useEffect(() => {
    if (!sections.length || !openParent) {
      return;
    }
    const nextParent = openParent;
    const subItem =
      nextParent.items.find((item) => item.id === activeSubItemId) ?? nextParent.items[0];

    if (subItem) {
      onSelectionChange?.({ parent: nextParent, subItem });
    }
  }, [activeSubItemId, onSelectionChange, openParent, sections]);

  const handleParentClick = (section: QuickAccessParentItem) => {
    if (openParentId === section.id) {
      setOpenParentId("");
      return;
    }

    setOpenParentId(section.id);
    if (section.items[0]) {
      setActiveSubItemId(section.items[0].id);
    }
  };

  return (
    <aside className="flex h-screen flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-7">
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#dbe8fb] text-[0.95rem] font-extrabold uppercase leading-[0.9] tracking-[-0.08em] text-[#2d63e2]">
            {appBadge}
          </div>
          <div>
            <h2 className="text-[0.95rem] font-extrabold uppercase tracking-[-0.04em] text-slate-800">
              {appName}
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-slate-500">{appTagline}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f7f9fc] px-3.5 py-5">
        <div className="space-y-3.5">
          {sections.map((section) => {
            const isOpen = section.id === openParentId;

            return (
              <div key={section.id} className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleParentClick(section)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[22px] border px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-200",
                    isOpen
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#dbe8fb] text-[1.45rem]">
                    {section.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[1.15rem] font-extrabold tracking-[-0.04em] text-slate-800">
                      {section.label}
                    </div>
                    <div className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[#88a2cb]">
                      {section.subtitle}
                    </div>
                  </div>
                  {section.badge ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-[0.72rem] font-bold text-red-500">
                      {section.badge}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200",
                        isOpen ? "rotate-180 text-blue-500" : "text-slate-400",
                      )}
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5 7.5L10 12.5L15 7.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </button>

                {isOpen && section.items.length > 0 ? (
                  <div className="space-y-2.5 px-2">
                    {section.items.map((item) => {
                      const isActive = item.id === activeSubItemId;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSubItemId(item.id)}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-all duration-200",
                            isActive
                              ? "border-blue-200 bg-white shadow-[0_10px_24px_rgba(37,99,235,0.08)]"
                              : "border-slate-200 bg-white/80 opacity-70 hover:opacity-100",
                          )}
                        >
                          {isActive ? (
                            <span
                              aria-hidden="true"
                              className="absolute right-[2px] top-1/2 h-[64%] w-[4px] -translate-y-1/2 rounded-full bg-[#2d63e2]"
                            />
                          ) : null}
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-[1.25rem]">
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "text-[1rem] font-semibold",
                                isActive ? "text-blue-600" : "text-slate-700",
                              )}
                            >
                              {item.label}
                            </div>
                            <div className="mt-0.5 text-[0.78rem] text-slate-400">{item.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbe8fb] text-[0.8rem] font-bold text-[#2d63e2]">
            {profileInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[0.95rem] font-bold text-slate-800">{profileName}</div>
            <div className="text-[0.6rem] uppercase tracking-[0.08em] text-slate-400">{profileRole}</div>
          </div>
          <div className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
        </div>

        <button
          type="button"
          className="w-full rounded-3xl bg-[#fb4343] px-5 py-3 text-[0.88rem] font-bold text-white transition-transform duration-200 hover:-translate-y-px"
        >
          {logoutLabel}
        </button>
      </div>
    </aside>
  );
}

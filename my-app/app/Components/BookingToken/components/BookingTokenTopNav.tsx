"use client";

import { TOP_NAV } from "../data/mock-data";

export default function BookingTokenTopNav() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--bt-border)] bg-[var(--bt-surface)] px-6">
      <div className="text-lg font-bold tracking-tight text-[var(--bt-text)]">StitchFlow CRM</div>
      <nav className="hidden items-center gap-8 md:flex">
        {TOP_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`relative pb-1 text-sm font-medium transition-colors ${
              item.active ? "text-[var(--bt-text)]" : "text-[var(--bt-muted)] hover:text-[var(--bt-text)]"
            }`}
          >
            {item.label}
            {item.active ? (
              <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-[var(--bt-sidebar-accent)]" />
            ) : null}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-[var(--bt-green)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--bt-navy)] shadow-sm transition hover:brightness-105"
        >
          New Deal
        </button>
        <button type="button" className="rounded-lg p-2 text-[var(--bt-muted)] hover:bg-[var(--bt-bg)]" aria-label="Notifications">
          <BellIcon />
        </button>
        <button type="button" className="rounded-lg p-2 text-[var(--bt-muted)] hover:bg-[var(--bt-bg)]" aria-label="Settings">
          <GearIcon />
        </button>
        <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-200 ring-2 ring-white">
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 text-xs font-bold text-white">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M12 4a4 4 0 0 0-4 4v2.5c0 .5-.2 1-.6 1.4L6 13.5V14h12v-.5l-1.4-1.6c-.4-.4-.6-.9-.6-1.4V8a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

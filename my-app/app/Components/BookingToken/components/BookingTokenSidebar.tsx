"use client";

import { SIDEBAR_NAV } from "../data/mock-data";

function NavIcon({ id }: { id: string }) {
  const cls = "h-4 w-4";
  if (id === "overview")
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  if (id === "pipeline")
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 6h5a3 3 0 0 1 3 3v5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  if (id === "ledger")
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="15" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  if (id === "team")
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M22 20v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
      <path d="M4 19V5M10 19V9M16 19V13M22 19V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function BookingTokenSidebar() {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--bt-border)] bg-[var(--bt-surface)]">
      <div className="border-b border-[var(--bt-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bt-navy)] text-sm font-bold text-[var(--bt-green)]">
            S
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--bt-text)]">Sales Ops</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bt-muted)]">
              Elite Division
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {SIDEBAR_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition ${
              item.active
                ? "bg-[var(--bt-sidebar-active)] text-[var(--bt-text)]"
                : "text-[var(--bt-muted)] hover:bg-[var(--bt-bg)] hover:text-[var(--bt-text)]"
            }`}
          >
            {item.active ? (
              <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-[var(--bt-sidebar-accent)]" />
            ) : null}
            <NavIcon id={item.id} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="space-y-1 border-t border-[var(--bt-border)] p-3">
        <button
          type="button"
          className="w-full rounded-lg bg-[var(--bt-navy)] px-3 py-2.5 text-xs font-bold text-[var(--bt-green)] transition hover:brightness-110"
        >
          Upgrade Plan
        </button>
        <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--bt-muted)] hover:bg-[var(--bt-bg)]">
          Help
        </button>
        <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--bt-muted)] hover:bg-[var(--bt-bg)]">
          Logout
        </button>
      </div>
    </aside>
  );
}

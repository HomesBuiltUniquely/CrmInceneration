"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  CRM_THEME_STORAGE_KEY,
  resolveInitialTheme,
  type CrmTheme,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19V21.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.93 4.93L6.7 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.3 17.3L19.07 19.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2.5 12H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 12H21.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.93 19.07L6.7 17.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.3 6.7L19.07 4.93" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M19 14.5A7.5 7.5 0 0 1 9.5 5A8.5 8.5 0 1 0 19 14.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [theme, setTheme] = useState<CrmTheme>(() => resolveInitialTheme());
  const isDark = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: CrmTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(CRM_THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Dark mode" : "Light mode"}
      className={cn(
        "inline-flex items-center border border-[var(--crm-border-strong)] bg-[var(--crm-surface-elevated)] text-[var(--crm-text-primary)] shadow-[var(--crm-shadow-sm)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--crm-accent)] hover:text-[var(--crm-accent)]",
        compact
          ? "h-10 w-10 justify-center rounded-full px-0 py-0"
          : "w-full justify-between rounded-full px-3.5 py-2.5 text-sm font-semibold",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          isDark
            ? "bg-[rgba(96,165,250,0.16)] text-[var(--crm-accent)]"
            : "bg-[rgba(245,158,11,0.16)] text-[var(--crm-warning-text)]",
        )}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
      {!compact ? <span>{isDark ? "Dark mode" : "Light mode"}</span> : null}
    </button>
  );
}

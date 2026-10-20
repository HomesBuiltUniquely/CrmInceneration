"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function MeetingsToolbar({
  query,
  fetching,
  total,
  onQuery,
}: {
  query: string;
  fetching: boolean;
  total: number | null;
  onQuery: (value: string) => void;
}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(query);
  const onQueryRef = useRef(onQuery);
  onQueryRef.current = onQuery;

  useEffect(() => {
    setText(query);
  }, [query]);

  useEffect(() => {
    if (text === query) return;
    const id = window.setTimeout(() => onQueryRef.current(text), 300);
    return () => window.clearTimeout(id);
  }, [text, query]);

  const pending = text !== query;
  const totalLabel = total == null ? "—" : `${new Intl.NumberFormat("en-IN").format(total)} ${total === 1 ? "meeting" : "meetings"}`;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 md:px-5">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search meetings</span>
        <span className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${text ? "text-[#334155]" : "text-[#64748B]"}`}>
          <SearchIcon />
        </span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search by customer, lead ID, designer or phone"
          className="h-8 w-full rounded-lg border border-[#E3E8EE] bg-white pl-8 pr-8 text-[13px] font-normal text-[#0F172A] outline-none placeholder:text-[#64748B] focus:border-[#334155] focus:ring-2 focus:ring-[#334155]/15"
        />
        {pending || fetching ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#334155]" aria-hidden>
            <Spinner reduce={Boolean(reduce)} />
          </span>
        ) : null}
      </label>
      <p className="shrink-0 text-right text-[12px] font-bold tabular-nums text-[#334155]" aria-live="polite">
        {totalLabel}
      </p>
    </div>
  );
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${reduce ? "opacity-70" : "animate-spin"}`} fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


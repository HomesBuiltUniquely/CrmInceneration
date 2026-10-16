"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { focusRing } from "./motion";

export function MeetingsToolbar({
  query,
  fetching,
  onQuery,
}: {
  query: string;
  fetching: boolean;
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
  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search meetings</span>
        <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${text ? "text-[#15803D]" : "text-[#5B6778]"}`}>
          <SearchIcon />
        </span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search by customer, lead ID, designer or phone"
          className={`h-11 w-full rounded-xl border border-[#E3E8EE] bg-white pl-10 pr-10 text-[14px] font-normal text-[#0F172A] outline-none placeholder:text-[#5B6778] focus:border-[#22C55E] focus:ring-4 focus:ring-[#22C55E]/20 ${focusRing}`}
        />
        {pending || fetching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#15803D]" aria-hidden>
            <Spinner reduce={Boolean(reduce)} />
          </span>
        ) : null}
      </label>
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


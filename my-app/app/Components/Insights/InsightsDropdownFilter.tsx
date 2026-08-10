"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  sublabel?: string;
  category?: string;
};

type Props = {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: "users" | "location" | "none";
  ariaLabel?: string;
  disabled?: boolean;
  /** Stretch trigger to container width (filter grids). */
  fullWidth?: boolean;
  /** Treat these values as inactive/default (no indigo highlight). Defaults: empty + "all". */
  defaultValues?: string[];
};

export default function InsightsDropdownFilter({
  options,
  value,
  onChange,
  placeholder,
  icon = "users",
  ariaLabel,
  disabled = false,
  fullWidth = false,
  defaultValues,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
      (opt.category && opt.category.toLowerCase().includes(query))
    );
  });

  // Group by category if options contain category labels
  const categories = Array.from(
    new Set(filteredOptions.map((opt) => opt.category).filter(Boolean)),
  ) as string[];

  const defaults = defaultValues ?? ["", "all"];
  const isDefaultSelected = defaults.includes(value);

  return (
    <div
      ref={rootRef}
      className={`relative text-left ${fullWidth ? "block w-full" : "inline-block"}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel || placeholder}
        className={`group inline-flex h-10 items-center justify-between gap-2.5 rounded-xl border px-3.5 text-xs font-semibold shadow-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-55 ${
          fullWidth ? "w-full" : ""
        } ${
          disabled
            ? "border-gray-200 bg-gray-50 text-gray-500"
            : !isDefaultSelected
              ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 shadow-indigo-100"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon === "users" ? (
            <svg
              className={`h-4 w-4 shrink-0 transition-colors ${
                !isDefaultSelected ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          ) : icon === "location" ? (
            <svg
              className={`h-4 w-4 shrink-0 transition-colors ${
                !isDefaultSelected ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          ) : null}
          <span className={`truncate ${fullWidth ? "min-w-0 flex-1 text-left" : "max-w-[140px] sm:max-w-[190px]"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-600" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled ? (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Search Box */}
          {options.length > 5 ? (
            <div className="border-b border-gray-100 bg-slate-50/80 p-2">
              <div className="relative flex items-center">
                <svg
                  className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-hidden"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No options match "{search}"</div>
            ) : categories.length > 0 ? (
              categories.map((cat) => {
                const catOpts = filteredOptions.filter((opt) => opt.category === cat);
                if (catOpts.length === 0) return null;
                return (
                  <div key={cat} className="mb-1.5">
                    <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {cat}
                    </p>
                    {catOpts.map((opt) => {
                      const isSelected = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onChange(opt.value);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all ${
                            isSelected
                              ? "bg-indigo-50 font-semibold text-indigo-900"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="truncate">
                            <span className="block text-xs truncate">{opt.label}</span>
                            {opt.sublabel ? (
                              <span className="block text-[10px] text-gray-400 font-normal truncate">
                                {opt.sublabel}
                              </span>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <svg
                              className="h-4 w-4 shrink-0 text-indigo-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "bg-indigo-50 font-semibold text-indigo-900"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="truncate">
                      <span className="block text-xs truncate">{opt.label}</span>
                      {opt.sublabel ? (
                        <span className="block text-[10px] text-gray-400 font-normal truncate">
                          {opt.sublabel}
                        </span>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <svg
                        className="h-4 w-4 shrink-0 text-indigo-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

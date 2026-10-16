"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import {
  DATE_PRESET_CARDS,
  formatRangeLabel,
  resolveDatePreset,
  toDateKey,
  type DatePresetId,
} from "@/lib/meeting-date-range";
import { EASE, focusRing, hoverLift } from "./motion";
import type { MeetingFilterState } from "./useMeetingFilters";

export type FilterOption = { id: string; label: string };

export type FilterDraft = Pick<
  MeetingFilterState,
  "designerIds" | "salesIds" | "branchIds" | "labels" | "preset" | "dateFrom" | "dateTo"
>;

const LABEL_OPTIONS = ["Showroom Visit", "Virtual Meeting", "Site Visit"];

export function FilterModal({
  open,
  value,
  designers,
  sales,
  branches,
  onClose,
  onApply,
}: {
  open: boolean;
  value: FilterDraft;
  designers: FilterOption[];
  sales: FilterOption[];
  branches: FilterOption[];
  onClose: () => void;
  onApply: (draft: FilterDraft) => void;
}) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<FilterDraft>(value);
  const [applying, setApplying] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const range = draft.preset
    ? resolveDatePreset(draft.preset, new Date(), { from: draft.dateFrom, to: draft.dateTo })
    : null;

  async function apply() {
    setApplying(true);
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    onApply(draft);
    setApplying(false);
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence>
      {open ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <motion.div
              className="fixed inset-0 z-[80] bg-[#0F172A]/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
          <motion.div
            className={`fixed z-[81] grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-[#E3E8EE] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)] ${
              mobile
                ? "inset-x-0 bottom-0 h-[100dvh] max-h-[100dvh] rounded-t-[24px]"
                : "h-[min(860px,90vh)] w-[min(1040px,calc(100vw-32px))] rounded-[24px]"
            }`}
            initial={
              reduce
                ? { opacity: 0 }
                : mobile
                  ? { opacity: 1, y: "100%" }
                  : { opacity: 0, x: "-50%", y: "calc(-50% + 12px)", scale: 0.96 }
            }
            animate={mobile ? { opacity: 1, y: 0 } : { opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.15 } }
                : mobile
                  ? { opacity: 1, y: "100%", transition: { duration: 0.15 } }
                  : { opacity: 0, x: "-50%", y: "calc(-50% + 8px)", scale: 0.98, transition: { duration: 0.15, ease: EASE } }
            }
            transition={{ duration: 0.22, ease: EASE }}
            style={mobile ? undefined : { top: "50%", left: "50%" }}
          >
            <header className="flex items-start gap-3 border-b border-[#E3E8EE] px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#15803D]">
                <FilterGlyph />
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title id="filter-meetings-title" className="text-[20px] font-bold text-[#0F172A]">
                  Filter meetings
                </Dialog.Title>
                <Dialog.Description className="text-[14px] font-normal text-[#5B6778]">
                  Narrow the list by people, branch, label and date.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#334155] hover:bg-[#F4F6F8] ${focusRing}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                  <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              </Dialog.Close>
            </header>
            <div className="grid min-h-0 gap-6 overflow-y-auto px-5 py-5 md:grid-cols-2">
              <section>
                <h3 className="text-[13px] font-bold text-[#334155]">Filters</h3>
                <div className="mt-4 space-y-5">
                  <MultiSelectChips
                    label="Designers"
                    placeholder="Search designers"
                    emptyLabel="All designers"
                    options={designers}
                    selected={draft.designerIds}
                    onChange={(designerIds) => setDraft((current) => ({ ...current, designerIds }))}
                  />
                  <MultiSelectChips
                    label="Sales"
                    placeholder="All sales team"
                    emptyLabel="All sales team"
                    options={sales}
                    selected={draft.salesIds}
                    onChange={(salesIds) => setDraft((current) => ({ ...current, salesIds }))}
                  />
                  <label className="block text-[13px] font-semibold text-[#334155]">
                    Branch
                    <select
                      value={draft.branchIds[0] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, branchIds: event.target.value ? [event.target.value] : [] }))
                      }
                      className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] bg-white px-3 text-[14px] font-semibold text-[#0F172A] ${focusRing}`}
                    >
                      <option value="">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="text-[13px] font-semibold text-[#334155]">Meeting label</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {LABEL_OPTIONS.map((label) => {
                        const selected = draft.labels.some((item) => item.toLowerCase() === label.toLowerCase());
                        return (
                          <motion.button
                            key={label}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                labels: selected
                                  ? current.labels.filter((item) => item.toLowerCase() !== label.toLowerCase())
                                  : [...current.labels, label],
                              }))
                            }
                            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold ${focusRing} ${
                              selected
                                ? "border-2 border-[#22C55E] bg-[#F0FDF4] text-[#14532D]"
                                : "border-[#E3E8EE] bg-white text-[#334155]"
                            }`}
                            {...hoverLift(reduce)}
                          >
                            <AnimatePresence>
                              {selected ? (
                                <motion.span
                                  initial={reduce ? { opacity: 0 } : { scale: 0 }}
                                  animate={reduce ? { opacity: 1 } : { scale: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 24 }}
                                >
                                  <CheckGlyph />
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
              <DateRangePresets
                preset={draft.preset}
                dateFrom={draft.dateFrom}
                dateTo={draft.dateTo}
                summary={formatRangeLabel(range)}
                onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              />
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-[#E3E8EE] px-5 py-4">
              <motion.button
                type="button"
                className={`group relative text-[14px] font-semibold text-[#334155] ${focusRing}`}
                onClick={() =>
                  setDraft({ designerIds: [], salesIds: [], branchIds: [], labels: [], preset: "", dateFrom: "", dateTo: "" })
                }
                whileHover="hover"
                initial="rest"
              >
                <span className="relative">
                  Reset all
                  <motion.span
                    aria-hidden
                    className="absolute -bottom-0.5 left-0 h-px w-full origin-left bg-current"
                    variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
                    transition={{ duration: 0.2, ease: EASE }}
                  />
                </span>
              </motion.button>
              <motion.button
                type="button"
                disabled={applying}
                onClick={() => void apply()}
                className={`inline-flex h-[52px] min-w-[160px] items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-5 text-[15px] font-bold text-[#052E16] shadow-[0_6px_14px_rgba(34,197,94,0.35)] disabled:opacity-70 ${focusRing}`}
                {...hoverLift(reduce)}
              >
                {applying ? <Spinner /> : null}
                Apply filters
              </motion.button>
            </footer>
          </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function DateRangePresets({
  preset,
  dateFrom,
  dateTo,
  summary,
  onChange,
}: {
  preset: DatePresetId | "";
  dateFrom: string;
  dateTo: string;
  summary: string;
  onChange: (patch: Pick<FilterDraft, "preset" | "dateFrom" | "dateTo">) => void;
}) {
  const reduce = useReducedMotion();
  const custom = preset === "custom";
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected: DateRange | undefined =
    dateFrom || dateTo
      ? { from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined, to: dateTo ? new Date(`${dateTo}T00:00:00`) : undefined }
      : undefined;

  return (
    <section>
      <h3 className="text-[13px] font-bold text-[#334155]">Date range</h3>
      <motion.p
        key={summary}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [1, 1.03, 1] }}
        transition={{ duration: 0.22, ease: EASE }}
        className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[#F0FDF4] px-3 text-[13px] font-semibold text-[#14532D]"
      >
        {summary}
      </motion.p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DATE_PRESET_CARDS.map((card) => {
          const active = preset === card.id;
          return (
            <motion.button
              key={card.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange({ preset: card.id, dateFrom: card.id === "custom" ? dateFrom : "", dateTo: card.id === "custom" ? dateTo : "" });
                if (card.id === "custom") setPickerOpen(true);
              }}
              className={`relative min-h-[72px] rounded-xl border px-3 py-2 text-left ${focusRing} ${
                active ? "border-2 border-[#22C55E] bg-[#F0FDF4] shadow-[0_6px_14px_rgba(34,197,94,0.25)]" : "border-[#E3E8EE] bg-white hover:border-[#86EFAC]"
              }`}
              {...(reduce ? {} : { whileHover: { y: -2 }, transition: { duration: 0.18, ease: EASE } })}
            >
              <span className="block text-[14px] font-bold text-[#0F172A]">{card.title}</span>
              <span className="mt-0.5 block text-[12px] font-normal text-[#5B6778]">{card.detail}</span>
              <AnimatePresence>
                {active ? (
                  <motion.span
                    className="absolute right-2 top-2 text-[#15803D]"
                    initial={reduce ? { opacity: 0 } : { scale: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 24 }}
                  >
                    <CheckCircle />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      <Popover.Root open={custom && pickerOpen} onOpenChange={setPickerOpen}>
        <Popover.Anchor asChild>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DateField label="From" value={dateFrom} disabled={!custom} onOpen={() => setPickerOpen(true)} />
            <DateField label="To" value={dateTo} disabled={!custom} onOpen={() => setPickerOpen(true)} />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            className="z-[90] rounded-2xl border border-[#E3E8EE] bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
            asChild
          >
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <DayPicker
                mode="range"
                selected={selected}
                onSelect={(next) =>
                  onChange({
                    preset: "custom",
                    dateFrom: next?.from ? toDateKey(next.from) : "",
                    dateTo: next?.to ? toDateKey(next.to) : "",
                  })
                }
              />
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </section>
  );
}

function DateField({
  label,
  value,
  disabled,
  onOpen,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <label className="block text-[13px] font-semibold text-[#334155]">
      {label}
      <input
        readOnly
        disabled={disabled}
        value={value}
        onClick={() => {
          if (!disabled) onOpen();
        }}
        placeholder="YYYY-MM-DD"
        className={`mt-1 h-11 w-full rounded-xl border px-3 text-[14px] font-semibold transition duration-200 ${focusRing} ${
          disabled
            ? "cursor-not-allowed border-[#E3E8EE] bg-[#F4F6F8] text-[#5B6778] opacity-70"
            : "cursor-pointer border-[#86EFAC] bg-white text-[#0F172A] opacity-100"
        }`}
      />
    </label>
  );
}

export function MultiSelectChips({
  label,
  placeholder,
  emptyLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  emptyLabel: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const needle = query.trim().toLowerCase();
  const visible = options.filter((option) => option.label.toLowerCase().includes(needle));
  const showList = openList || needle.length > 0;
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#334155]">
        {label}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpenList(true)}
          onBlur={() => window.setTimeout(() => setOpenList(false), 180)}
          placeholder={selected.length ? placeholder : emptyLabel}
          className={`mt-1 h-11 w-full rounded-xl border border-[#E3E8EE] bg-white px-3 text-[14px] font-semibold text-[#0F172A] outline-none placeholder:font-normal placeholder:text-[#5B6778] focus:border-[#22C55E] focus:ring-4 focus:ring-[#22C55E]/15 ${focusRing}`}
        />
      </label>
      <AnimatePresence initial={false}>
        {selected.length ? (
          <motion.div layout className="mt-2 flex flex-wrap gap-2">
            {selected.map((id) => {
              const option = options.find((item) => item.id === id);
              return (
                <motion.button
                  key={id}
                  type="button"
                  layout={reduce ? undefined : true}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  aria-label={`Remove ${option?.label ?? id}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange(selected.filter((item) => item !== id))}
                  className={`inline-flex min-h-8 items-center gap-1 rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 text-[12px] font-semibold text-[#14532D] ${focusRing}`}
                >
                  {option?.label ?? id}
                  <span aria-hidden>×</span>
                </motion.button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {showList ? (
        <ul className="mt-2 max-h-36 overflow-auto rounded-xl border border-[#E3E8EE]">
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-[13px] font-normal text-[#5B6778]">No matches</li>
          ) : (
            visible.map((option) => {
              const on = selected.includes(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
                    className={`flex min-h-11 w-full items-center px-3 text-left text-[14px] font-semibold ${focusRing} ${
                      on ? "bg-[#F0FDF4] text-[#14532D]" : "text-[#0F172A] hover:bg-[#F7F9FA]"
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function FilterGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 6h16l-6 7v5l-4-2v-3L4 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M3.5 8.2L6.4 11.1L12.5 4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="#22C55E" />
      <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#052E16" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

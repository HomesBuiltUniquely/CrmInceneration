"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  leadType: string;
  leadId: string;
};

const sections = [
  "Basic Understanding",
  "Requirement Scope",
  "Reference & Inspiration",
  "Financial Guardrails",
  "Internal Executive Notes",
];

export default function NewConfigurationScopePage({ leadType, leadId }: Props) {
  return (
    <main className="min-h-screen bg-[#f3f5f7] px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-[1320px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#dfe5ec] bg-white p-4">
          <h2 className="text-2xl font-extrabold text-[#0f172a]">DesignScope CRM</h2>
          <p className="mt-2 text-xs font-semibold text-[#6c788b]">
            Project Lead: Amit Sharma • LID-8842
          </p>
          <ul className="mt-5 space-y-2">
            {sections.map((section, idx) => (
              <li
                key={section}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  idx === 1
                    ? "border-[#f4c66f] bg-[#fff8ea] text-[#9a5c00]"
                    : idx === 0
                      ? "border-[#16d45f] bg-[#f2fff6] text-[#0c8f3f]"
                      : "border-[#e6ebf2] bg-white text-[#4a5565]"
                }`}
              >
                {idx + 1}. {section}
              </li>
            ))}
          </ul>
          <Link
            href={`/Leads/new/${leadType}/${leadId}`}
            className="mt-5 inline-flex rounded-lg border border-[#d2dae5] px-3 py-2 text-xs font-semibold text-[#1f2937]"
          >
            Back To Lead Details
          </Link>
        </aside>

        <section className="space-y-4">
          <BasicUnderstandingSection />
          <RequirementScopeSection />
          <ReferenceInspirationSection />
          <FinancialGuardrailsSection />
          <InternalExecutiveNotesSection />
        </section>
      </div>
    </main>
  );
}

function FinancialGuardrailsSection() {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 10h.01M18 14h.01" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">4. Financial Guardrails</h3>
      </div>

      <div className="rounded-xl bg-[#0f1b38] p-5 text-white">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4ade80]">Total Investment Range</p>
            <p className="mt-1 text-[42px] font-black leading-none tracking-tight">₹12L - 15L</p>
            <p className="mt-2 text-[13px] text-[#c5d4f3]">
              Targeting a &apos;Premium Balanced&apos; finish with 10% buffer.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#1a2644] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#7b8db5]">Sensitivity</p>
                <p className="mt-1 text-[14px] font-semibold">Low / Moderate</p>
              </div>
              <div className="rounded-lg bg-[#1a2644] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#7b8db5]">Financing</p>
                <p className="mt-1 text-[14px] font-semibold">Self Funded</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-[#9bb2e3]">
              <span>Value Focus</span>
              <span>Luxury Focus</span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-[#2a3a5c]">
              <div className="absolute left-[72%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1ed760]" />
            </div>
            <p className="mt-3 text-[12px] italic text-[#c5d4f3]">
              Client prefers luxury finishes in Living Area &amp; Kitchen specifically.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function InternalExecutiveNotesSection() {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1f2937] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">5. Internal Executive Notes</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <FormLabel>Personality Type</FormLabel>
          <div className="relative mt-1.5">
            <select
              disabled
              className="h-[42px] w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 text-[13px] font-medium text-[#374151] outline-none"
              defaultValue="analytical"
            >
              <option value="analytical">Analytical (Data Driven)</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
          </div>
        </div>
        <div>
          <FormLabel>Closure Probability</FormLabel>
          <div className="mt-1.5 flex gap-2">
            <span className="rounded-md bg-[#1ed760] px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#05220f]">
              Hot
            </span>
            <span className="rounded-md border border-[#e4e8ef] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
              Warm
            </span>
            <span className="rounded-md border border-[#e4e8ef] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
              Cold
            </span>
          </div>
        </div>
        <div>
          <FormLabel>Competition</FormLabel>
          <input
            readOnly
            value="Livspace, HomeLane etc."
            className="mt-1.5 h-[42px] w-full rounded-md border border-[#dfe5ec] bg-white px-3 text-[13px] text-[#374151] outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <FormLabel>Executive Summary for Designer</FormLabel>
        <textarea
          readOnly
          placeholder="Add specific notes about quirky requirements, negotiation hooks, or technical constraints..."
          className="mt-1.5 min-h-[120px] w-full resize-y rounded-md border border-[#e4e8ef] bg-white px-3 py-2.5 text-[13px] text-[#9ca3af] outline-none"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[#e5e7eb] pt-4">
        <div>
          <p className="text-[13px] font-bold text-[#111827]">Last saved: Today at 02:45 PM</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">Generated by Sales Lead: Vikram Singh</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[#111827] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-wide text-[#111827]"
          >
            Print PDF
          </button>
          <button
            type="button"
            className="rounded-md bg-[#1ed760] px-5 py-2.5 text-[11px] font-black uppercase tracking-wide text-[#05220f]"
          >
            Finalize &amp; Submit
          </button>
        </div>
      </div>
    </article>
  );
}

function ReferenceInspirationSection() {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">3. Reference &amp; Inspiration</h3>
      </div>
      <p className="mb-4 text-[13px] text-[#9ca3af]">
        Upload customer reference images, sketches, or style inspiration.
      </p>

      <div className="rounded-xl border border-dashed border-[#cfd6e0] bg-[#fafbfc] px-6 py-10 text-center">
        <svg
          viewBox="0 0 24 24"
          className="mx-auto mb-4 h-10 w-10 text-[#4b7cff]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-[15px] font-bold text-[#111827]">Click or Drag images here to upload</p>
        <p className="mt-1 text-[12px] text-[#9ca3af]">Support for JPG, PNG, PDF (Max 10MB per file)</p>
        <button
          type="button"
          className="mt-5 rounded-md bg-[#0f172a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white"
        >
          Browse Files
        </button>
      </div>

      <div className="mt-5">
        <FormLabel>Reference Gallery</FormLabel>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <GalleryPlaceholder label="REF_01.JPG" />
          <GalleryPlaceholder label="REF_02.JPG" />
          <button
            type="button"
            aria-label="Add reference image"
            className="flex min-h-[100px] items-center justify-center rounded-lg border border-[#e4e8ef] bg-[#f3f4f6] text-[28px] font-light text-[#9ca3af]"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-5">
        <FormLabel>Additional Aesthetic Notes</FormLabel>
        <textarea
          readOnly
          placeholder="Mention specific details about lighting, textures, or mood from these references..."
          className="mt-1.5 min-h-[100px] w-full resize-y rounded-md border border-[#e4e8ef] bg-white px-3 py-2.5 text-[13px] text-[#9ca3af] outline-none"
        />
      </div>
    </article>
  );
}

function GalleryPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative min-h-[100px] rounded-lg border border-[#e4e8ef] bg-[#f3f4f6]">
      <div className="flex h-full min-h-[100px] items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#c4cad4]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
      <span className="absolute bottom-2 left-2 text-[9px] font-semibold uppercase tracking-wide text-[#9ca3af]">
        {label}
      </span>
    </div>
  );
}

function RequirementScopeSection() {
  const availableRooms = [
    { name: "Living Room", selected: true },
    { name: "Modular Kitchen", selected: true },
    { name: "Foyer", selected: false },
    { name: "Master Bedroom", selected: false },
    { name: "Guest Bedroom", selected: false },
  ];

  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">2. Requirement Scope</h3>
      </div>

      <div className="rounded-lg border border-[#e4e8ef] p-4">
        <FormLabel>Spaces to be Designed</FormLabel>

        <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Available Rooms</p>
            <div className="space-y-2">
              {availableRooms.map((room) => (
                <button
                  key={room.name}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-[13px] font-semibold ${
                    room.selected
                      ? "border-[#1ed760] bg-[#f2fff8] text-[#0f8f3d]"
                      : "border-[#e4e8ef] bg-white text-[#4b5563]"
                  }`}
                >
                  {room.name}
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      room.selected
                        ? "bg-[#1ed760] text-white"
                        : "border border-[#d1d5db] bg-white text-[#9ca3af]"
                    }`}
                  >
                    {room.selected ? "✓" : "+"}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-dashed border-[#d1d5db] bg-white px-3 py-2.5 text-[13px] font-medium text-[#9ca3af]"
              >
                Add New Room
                <span className="text-[16px] leading-none">+</span>
              </button>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
              Configuring Selected Spaces (2)
            </p>
            <div className="space-y-4">
              <RoomConfigCard
                title="Living Room"
                iconLabel="🛋"
                units={[
                  { label: "TV Unit", active: true },
                  { label: "Sofa", active: false },
                  { label: "Center Table", active: false },
                ]}
                notesPlaceholder="e.g. Minimalist vibe..."
              />
              <RoomConfigCard
                title="Modular Kitchen"
                iconLabel="B"
                units={[
                  { label: "Base Units", active: true },
                  { label: "Wall Units", active: true },
                  { label: "Tall Unit", active: false },
                ]}
                notesPlaceholder="e.g. Quartz countertop preferred..."
              />
            </div>
          </div>
        </div>

        <ScopeExtrasSection />
      </div>
    </article>
  );
}

function ScopeExtrasSection() {
  const addOns = ["Painting", "Granite", "Kitchen Tile", "Wallpaper", "Appliance", "Wooden Flooring"];

  return (
    <>
      <div className="mt-5 rounded-lg border border-dashed border-[#cfd6e0] bg-[#fafbfc] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f0f8] text-[#6b8aad]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="1.5" />
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="19" cy="5" r="1.5" />
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </span>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#374151]">Miscellaneous Add-ons</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {addOns.map((item) => (
            <label
              key={item}
              className="flex min-h-[42px] items-center justify-between rounded-md border border-[#e4e8ef] bg-white px-3 py-2 text-[13px] font-medium text-[#374151]"
            >
              {item}
              <span className="inline-flex h-[18px] w-[18px] shrink-0 rounded-[3px] border border-[#d1d5db] bg-white" />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-dashed border-[#cfd6e0] bg-white">
          <button
            type="button"
            className="flex min-h-[120px] flex-col items-center justify-center border-r border-dashed border-[#cfd6e0] px-4 py-6 text-center"
          >
            <svg
              viewBox="0 0 24 24"
              className="mb-3 h-8 w-8 text-[#4b6b8a]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-[11px] font-black uppercase tracking-[0.06em] text-[#4b6b8a]">Upload New Plan</p>
            <p className="mt-1 text-[10px] text-[#9ca3af]">PDF, JPG, DWG (Max 10MB)</p>
          </button>
          <button
            type="button"
            className="flex min-h-[120px] flex-col items-center justify-center px-4 py-6 text-center"
          >
            <svg
              viewBox="0 0 24 24"
              className="mb-3 h-8 w-8 text-[#4b6b8a]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <p className="text-[11px] font-black uppercase tracking-[0.06em] text-[#4b6b8a]">View Floor Plan</p>
            <p className="mt-1 text-[10px] text-[#9ca3af]">Uploaded on Feb 12</p>
          </button>
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <FormLabel>Kitchen Layout</FormLabel>
            <div className="relative mt-1.5">
              <select
                disabled
                className="h-[42px] w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 text-[14px] font-medium text-[#374151] outline-none"
                defaultValue="L-Shaped with Island"
              >
                <option>L-Shaped with Island</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
            </div>
          </div>
          <div>
            <FormLabel>Material Finish</FormLabel>
            <div className="relative mt-1.5">
              <select
                disabled
                className="h-[42px] w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 text-[14px] font-medium text-[#374151] outline-none"
                defaultValue="High Gloss Acrylic"
              >
                <option>High Gloss Acrylic</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RoomConfigCard({
  title,
  iconLabel,
  units,
  notesPlaceholder,
}: {
  title: string;
  iconLabel: string;
  units: Array<{ label: string; active: boolean }>;
  notesPlaceholder: string;
}) {
  return (
    <div className="rounded-lg border border-[#b8f0cc] bg-[#f6fff9] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1ed760] text-[11px] font-bold text-white">
            {iconLabel}
          </span>
          <p className="text-[13px] font-black uppercase tracking-wide text-[#111827]">{title}</p>
        </div>
        <button type="button" aria-label={`Remove ${title}`} className="text-[#ef4444]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <FormLabel>Units Required</FormLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {units.map((unit) => (
              <span
                key={unit.label}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  unit.active
                    ? "bg-[#1ed760] text-[#05220f]"
                    : "border border-[#e4e8ef] bg-white text-[#6b7280]"
                }`}
              >
                {unit.label}
              </span>
            ))}
            <span className="rounded-md border border-dashed border-[#d1d5db] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9ca3af]">
              + Add Unit
            </span>
          </div>
        </div>
        <div>
          <FormLabel>False Ceiling</FormLabel>
          <label className="mt-2 flex items-center gap-2 rounded-md border border-[#e4e8ef] bg-white px-3 py-2">
            <span className="inline-flex h-4 w-4 rounded-[3px] border border-[#d1d5db] bg-white" />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">Required</span>
          </label>
        </div>
      </div>

      <div className="mt-4">
        <FormLabel>Specific Room Notes</FormLabel>
        <textarea
          readOnly
          placeholder={notesPlaceholder}
          className="mt-1 min-h-[72px] w-full rounded-md border border-[#e4e8ef] bg-white px-3 py-2 text-[13px] text-[#9ca3af] outline-none"
        />
      </div>
    </div>
  );
}

function BasicUnderstandingSection() {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-[12px] font-bold text-white">
          i
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">1. Basic Understanding</h3>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e4e8ef]">
        <div className="grid lg:grid-cols-[1fr_220px]">
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <FormLabel>Property Name / Site</FormLabel>
              <input
                readOnly
                value="Sharma Heights, Block C"
                className="mt-1 w-full rounded-md border border-[#dfe5ec] bg-white px-3 py-2 text-[14px] text-[#374151] outline-none"
              />
            </div>
            <div className="md:col-span-1">
              <FormLabel>Family Size &amp; Details</FormLabel>
              <input
                readOnly
                placeholder="e.g. 2 Adults, 1 Child, 1 Pet"
                className="mt-1 w-full rounded-md border border-[#dfe5ec] bg-white px-3 py-2 text-[14px] text-[#9ca3af] outline-none"
              />
            </div>
            <div>
              <FormLabel>BHK Type</FormLabel>
              <div className="relative mt-1">
                <select
                  disabled
                  className="w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 py-2 text-[14px] text-[#374151] outline-none"
                  defaultValue="3 BHK"
                >
                  <option>3 BHK</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
              </div>
            </div>
            <div>
              <FormLabel>Type</FormLabel>
              <div className="relative mt-1">
                <select
                  disabled
                  className="w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 py-2 text-[14px] text-[#374151] outline-none"
                  defaultValue="Apartment"
                >
                  <option>Apartment</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <CheckboxField label="WFH Setup" checked={false} />
              <CheckboxField label="Pet Friendly" checked />
            </div>
          </div>

          <div className="border-l-2 border-[#1ed760] bg-[#f5f7fa] p-4">
            <FormLabel>Timeline Expectation</FormLabel>
            <div className="mt-3 space-y-3">
              <RadioOption label="45 Days (Express)" selected={false} />
              <RadioOption label="90 Days (Standard)" selected />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function FormLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{children}</p>
  );
}

function CheckboxField({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-[#e4e8ef] bg-white px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</span>
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border ${
          checked ? "border-[#1ed760] bg-[#1ed760] text-[10px] text-white" : "border-[#d1d5db] bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
    </label>
  );
}

function RadioOption({ label, selected }: { label: string; selected: boolean }) {
  return (
    <label className="flex cursor-default items-center gap-2">
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          selected ? "border-[#1ed760]" : "border-[#d1d5db]"
        }`}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[#1ed760]" /> : null}
      </span>
      <span className="text-[13px] font-medium text-[#374151]">{label}</span>
    </label>
  );
}

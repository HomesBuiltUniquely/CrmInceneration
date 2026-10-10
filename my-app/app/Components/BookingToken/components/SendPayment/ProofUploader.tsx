"use client";

import type { ChangeEvent, DragEvent, RefObject } from "react";

export type DraftProof = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  required: boolean;
  draftProofs: DraftProof[];
  dragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  fieldError?: string;
  onPickFiles: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onRemoveProof: (id: string) => void;
  onPreviewProof: (proof: DraftProof) => void;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProofUploader({
  required,
  draftProofs,
  dragActive,
  fileInputRef,
  disabled = false,
  fieldError,
  onPickFiles,
  onFileInputChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onRemoveProof,
  onPreviewProof,
}: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
          Payment proof
        </p>
        {required ? (
          <span className="rounded-full bg-[#FFF8EB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#92400E]">
            Required
          </span>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        multiple
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled}
      />

      <div
        onDrop={disabled ? undefined : onDrop}
        onDragOver={disabled ? undefined : onDragOver}
        onDragLeave={disabled ? undefined : onDragLeave}
        className={`sp-card mt-2 flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center ${
          dragActive
            ? "border-[#047857] bg-[#E7F6EF]"
            : "border-[#CBD3DD] bg-[#F7F9FA] hover:border-[#0F172A]/30"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E7F6EF] text-[#047857]"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M12 16V7M8.5 10.5 12 7l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="mt-2 text-[13px] font-semibold text-[#0F172A]">Drag screenshots here</p>
        <p className="mt-0.5 text-[12px] text-[#5B6778]">PNG or JPG, multiple allowed</p>
        <button
          type="button"
          onClick={onPickFiles}
          disabled={disabled}
          className="sp-chip mt-3 inline-flex min-h-11 items-center rounded-[14px] border border-[#E3E8EE] bg-white px-4 text-[13px] font-semibold text-[#0F172A] shadow-sm hover:border-[#CBD3DD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:opacity-60"
        >
          Browse files
        </button>
      </div>

      {draftProofs.length > 0 ? (
        <ul className="mt-2.5 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto">
          {draftProofs.map((proof) => (
            <li
              key={proof.id}
              className="relative overflow-hidden rounded-[14px] border border-[#E3E8EE] bg-white"
            >
              <button
                type="button"
                onClick={() => onPreviewProof(proof)}
                className="block w-full text-left"
                aria-label={`Preview ${proof.file.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proof.previewUrl}
                  alt={proof.file.name}
                  className="h-16 w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => onRemoveProof(proof.id)}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-[12px] font-bold text-white hover:bg-black/80"
                aria-label={`Remove ${proof.file.name}`}
              >
                ×
              </button>
              <p className="truncate px-2 pt-1 text-[10px] text-[#5B6778]">{proof.file.name}</p>
              <p className="px-2 pb-1 text-[10px] text-[#94a3b8]">{formatBytes(proof.file.size)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {fieldError ? (
        <p className="mt-2 text-[12px] text-[#b91c1c]" role="alert" aria-live="polite">
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}

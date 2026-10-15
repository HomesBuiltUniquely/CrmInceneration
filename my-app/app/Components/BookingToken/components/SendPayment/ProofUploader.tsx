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

function FileGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v5a1 1 0 0 0 1 1h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13h7M8.5 16.5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Compact proof uploader — sized to content so the parent SoftScroll
 * can fade-scroll notes + proof on short laptop viewports (no nested scroll).
 */
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
  const hasProofs = draftProofs.length > 0;
  const countLabel =
    draftProofs.length === 1
      ? "1 proof uploaded"
      : `${draftProofs.length} proofs uploaded`;

  return (
    <section className="shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5B6778]">
          Payment proof
        </p>
        {required ? (
          <span className="rounded-full bg-[#FFF8EB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#92400E]">
            Required
          </span>
        ) : null}
        {hasProofs ? (
          <span className="rounded-full bg-[#E7F6EF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#047857]">
            Done
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

      {!hasProofs ? (
        <div
          onDrop={disabled ? undefined : onDrop}
          onDragOver={disabled ? undefined : onDragOver}
          onDragLeave={disabled ? undefined : onDragLeave}
          className={`sp-card mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-3.5 text-center ${
            dragActive
              ? "border-[#047857] bg-[#E7F6EF]"
              : "border-[#CBD3DD] bg-[#F7F9FA] hover:border-[#0F172A]/30"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F6EF] text-[#047857]"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="M12 16V7M8.5 10.5 12 7l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="mt-1.5 text-[13px] font-semibold text-[#0F172A]">
            Drag screenshots here
          </p>
          <p className="mt-0.5 text-[11px] text-[#5B6778]">
            PNG or JPG, multiple allowed
          </p>
          <button
            type="button"
            onClick={onPickFiles}
            disabled={disabled}
            className="sp-chip mt-2.5 inline-flex min-h-9 items-center rounded-[12px] border border-[#E3E8EE] bg-white px-3.5 text-[12px] font-semibold text-[#0F172A] shadow-sm hover:border-[#CBD3DD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:opacity-60"
          >
            Browse files
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {/* Done box + brown file buttons on the right */}
          <div
            onDrop={disabled ? undefined : onDrop}
            onDragOver={disabled ? undefined : onDragOver}
            onDragLeave={disabled ? undefined : onDragLeave}
            className={`sp-card flex items-stretch gap-2 rounded-2xl border px-2.5 py-2 ${
              dragActive
                ? "border-[#047857] bg-[#E7F6EF]"
                : "border-[#047857]/35 bg-[#F3FBF7]"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7F6EF] text-[#047857]"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path
                    d="M5.5 12.5 10 17l8.5-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#0F172A]">
                  Proof uploaded
                </p>
                <p className="truncate text-[10px] text-[#5B6778]">
                  {countLabel}
                  {dragActive ? " · Drop to add more" : ""}
                </p>
              </div>
            </div>

            <div className="flex max-w-[48%] shrink-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {draftProofs.map((proof, index) => (
                <div key={proof.id} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreviewProof(proof)}
                    title={proof.file.name}
                    aria-label={`Open proof ${index + 1}: ${proof.file.name}`}
                    className="sp-chip inline-flex h-10 min-w-10 flex-col items-center justify-center rounded-[11px] border border-[#D6B48A] bg-[#F5E6D3] px-1.5 text-[#7A4E1D] shadow-sm hover:border-[#B88955] hover:bg-[#EED9BC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92400E]/35"
                  >
                    <FileGlyph className="h-3.5 w-3.5" />
                    <span className="mt-0.5 text-[9px] font-bold tabular-nums leading-none">
                      {index + 1}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveProof(proof.id)}
                    disabled={disabled}
                    className="absolute -right-1 -top-1 inline-flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#7A4E1D] text-[8px] font-bold leading-none text-white hover:bg-[#5C3A14] disabled:opacity-50"
                    aria-label={`Remove ${proof.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPickFiles}
              disabled={disabled}
              className="sp-chip inline-flex min-h-8 items-center rounded-[10px] border border-[#E3E8EE] bg-white px-2.5 text-[11px] font-semibold text-[#0F172A] hover:border-[#CBD3DD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:opacity-60"
            >
              Add more
            </button>
            <p className="text-[10px] text-[#5B6778]">
              Tap a brown file to preview
            </p>
          </div>

          <ul className="space-y-1.5">
            {draftProofs.map((proof, index) => (
              <li
                key={proof.id}
                className="flex items-center gap-2 rounded-[12px] border border-[#E8D5BC] bg-[#FFFBF5] px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onPreviewProof(proof)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#D6B48A] bg-[#F5E6D3] text-[#7A4E1D]"
                  aria-label={`Preview ${proof.file.name}`}
                >
                  <FileGlyph className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onPreviewProof(proof)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[12px] font-semibold text-[#0F172A]">
                    Proof {index + 1} · {proof.file.name}
                  </p>
                  <p className="text-[10px] text-[#94a3b8]">
                    {formatBytes(proof.file.size)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveProof(proof.id)}
                  disabled={disabled}
                  className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-[#7A4E1D] hover:bg-[#F5E6D3] disabled:opacity-50"
                  aria-label={`Remove ${proof.file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fieldError ? (
        <p
          className="mt-2 text-[12px] text-[#b91c1c]"
          role="alert"
          aria-live="polite"
        >
          {fieldError}
        </p>
      ) : null}
    </section>
  );
}

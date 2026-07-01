"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  FLOOR_PLAN_ACCEPT,
  FLOOR_PLAN_MAX_BYTES,
  isFloorPlanImageKey,
  isFloorPlanPdfKey,
  formatFloorPlanStreamError,
  validateFloorPlanFile,
} from "@/lib/floor-plan";

type Props = {
  hasFloorPlan: boolean;
  floorPlanS3Key?: string;
  /** Permanent public link — preferred for open in new tab. */
  publicLink?: string;
  /** Auth proxy: `/api/crm/lead/.../floor-plan/content` */
  viewHref: string;
  /** Auth proxy: `/api/crm/lead/.../floor-plan/open` */
  openHref: string;
  canUpload: boolean;
  uploading: boolean;
  onFileSelect: (file: File) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Called when S3 object missing — parent should clear stale floor plan state. */
  onFloorPlanMissing?: () => void;
  onRemove?: () => void | Promise<void>;
  removing?: boolean;
  /** Shorter drop zone — matches V2 Configure Scope card height. */
  compact?: boolean;
  /** Hide built-in title row — parent renders label + badges for alignment. */
  hideHeader?: boolean;
  className?: string;
};

function formatMaxSize(): string {
  const mb = FLOOR_PLAN_MAX_BYTES / (1024 * 1024);
  return `${mb} MB`;
}

function FileTypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-muted)]">
      {label}
    </span>
  );
}

async function openFloorPlanInNewTab(openHref: string) {
  if (!openHref) return;

  const res = await fetch(openHref, {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    let raw = "";
    try {
      const body = (await res.json()) as { userMessage?: string; error?: string };
      raw = body.userMessage?.trim() || body.error?.trim() || "";
    } catch {
      raw = "";
    }
    throw new Error(formatFloorPlanStreamError(raw || `HTTP ${res.status}`));
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

export default function FloorPlanUpload({
  hasFloorPlan,
  floorPlanS3Key = "",
  publicLink = "",
  viewHref,
  openHref,
  canUpload,
  uploading,
  onFileSelect,
  onError,
  onFloorPlanMissing,
  onRemove,
  removing = false,
  compact = false,
  hideHeader = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");
  const [opening, setOpening] = useState(false);
  const busy = uploading || removing;

  const processFile = useCallback(
    async (file: File | null) => {
      if (!file || !canUpload) return;
      const err = validateFloorPlanFile(file);
      if (err) {
        onError?.(err);
        return;
      }
      await onFileSelect(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [canUpload, onError, onFileSelect],
  );

  const openPicker = () => {
    if (!busy && canUpload) inputRef.current?.click();
  };

  const key = floorPlanS3Key.trim();
  const publicHref = publicLink.trim();
  const isImage = hasFloorPlan && isFloorPlanImageKey(key || publicHref);
  const isPdf = hasFloorPlan && isFloorPlanPdfKey(key || publicHref);

  useEffect(() => {
    if (!hasFloorPlan || !isImage) {
      setPreviewSrc("");
      return;
    }
    if (publicHref) {
      setPreviewSrc(publicHref);
      return;
    }
    if (!viewHref) {
      setPreviewSrc("");
      return;
    }
    let revoked = "";
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(viewHref, {
          credentials: "include",
          headers: getCrmAuthHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error("preview failed");
        const blob = await res.blob();
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setPreviewSrc(revoked);
      } catch {
        if (!cancelled) setPreviewSrc("");
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [hasFloorPlan, isImage, viewHref, publicHref, key]);

  const hasFile = hasFloorPlan;

  const handleOpen = () => {
    if (opening || busy) return;
    if (publicHref) {
      window.open(publicHref, "_blank", "noopener,noreferrer");
      return;
    }
    if (!openHref) return;
    setOpening(true);
    void openFloorPlanInNewTab(openHref)
      .catch((e) => {
        const msg =
          e instanceof Error && e.message && !e.message.startsWith("OPEN_FAILED:")
            ? formatFloorPlanStreamError(e.message)
            : "Cannot open floor plan. Log in again or retry.";
        onError?.(msg);
        if (
          msg.toLowerCase().includes("missing in storage") ||
          msg.toLowerCase().includes("key does not exist")
        ) {
          onFloorPlanMissing?.();
        }
      })
      .finally(() => setOpening(false));
  };

  const handleRemove = () => {
    if (!onRemove || busy) return;
    if (!window.confirm("Remove this floor plan from the lead?")) return;
    void onRemove();
  };

  return (
    <div className={cn(compact ? "mt-0" : "mt-4", className)}>
      {!hideHeader ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
            Floor plan
          </p>
          <div className="flex flex-wrap gap-1">
            <FileTypeBadge label="PDF" />
            <FileTypeBadge label="JPG" />
            <FileTypeBadge label="PNG" />
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={FLOOR_PLAN_ACCEPT}
        className="sr-only"
        disabled={!canUpload || busy}
        onChange={(e) => void processFile(e.target.files?.[0] ?? null)}
      />

      {hasFile ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-gradient-to-br from-[var(--crm-surface-subtle)] to-[var(--crm-surface)]">
          {isImage ? (
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="group relative block w-full cursor-pointer text-left"
            >
              {previewSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewSrc}
                  alt="Floor plan preview"
                  className="max-h-52 w-full object-contain bg-white/60 p-2 transition group-hover:brightness-[0.98] dark:bg-black/20"
                />
              ) : (
                <div className="flex max-h-52 min-h-[8rem] w-full items-center justify-center bg-white/60 p-6 dark:bg-black/20">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--crm-accent)] border-t-transparent" />
                </div>
              )}
              <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                Preview
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left transition hover:bg-[var(--crm-surface-subtle)]/80 disabled:opacity-60"
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg",
                  isPdf
                    ? "bg-rose-500/10 text-rose-600"
                    : "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]",
                )}
                aria-hidden
              >
                {isPdf ? "PDF" : "📄"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--crm-text-primary)]">
                  Floor plan attached
                </p>
                <p className="text-[11px] text-[var(--crm-text-muted)]">
                  {isPdf ? "PDF document" : "Document"} · click to open
                </p>
              </div>
            </button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--crm-border)] bg-[var(--crm-surface)]/80 px-3 py-2.5">
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening || !openHref}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--crm-accent)] hover:underline disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M14 3h7v7M10 14L21 3M5 10H3v11h11v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {opening ? "Opening…" : "Open in new tab"}
            </button>
            {canUpload ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={openPicker}
                  className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--crm-text-secondary)] transition hover:border-[var(--crm-accent)] hover:text-[var(--crm-accent)] disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Replace"}
                </button>
                {onRemove ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRemove}
                    aria-label={removing ? "Removing floor plan" : "Remove floor plan"}
                    title={removing ? "Removing…" : "Remove floor plan"}
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
                      "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-muted)]",
                      "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-1",
                      "disabled:pointer-events-none disabled:opacity-45",
                      "dark:hover:border-rose-800 dark:hover:bg-rose-950/50 dark:hover:text-rose-400",
                    )}
                  >
                    {removing ? (
                      <span
                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden
                      />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden
                      >
                        <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canUpload || busy}
          onClick={openPicker}
          onDragEnter={(e) => {
            e.preventDefault();
            if (canUpload && !busy) setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (canUpload && !busy) setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!canUpload || busy) return;
            const file = e.dataTransfer.files?.[0];
            void processFile(file ?? null);
          }}
          className={cn(
            "group relative w-full border-dashed px-4 text-center transition-all duration-200",
            compact
              ? "flex h-[148px] flex-col items-center justify-center gap-1 rounded-lg border py-0"
              : "rounded-2xl border-2 py-8",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent)] focus-visible:ring-offset-2",
            canUpload && !uploading
              ? dragOver
                ? compact
                  ? "scale-[1.01] border-[#2ee06a] bg-[#f0fdf4] shadow-[0_8px_24px_rgba(46,224,106,0.15)]"
                  : "border-[var(--crm-accent)] bg-[var(--crm-accent-soft)] scale-[1.01]"
                : compact
                  ? "cursor-pointer border-[#c8d0db] bg-white hover:-translate-y-0.5 hover:border-[#2ee06a] hover:bg-[#f0fdf4] hover:shadow-[0_8px_24px_rgba(46,224,106,0.15)] active:scale-[0.99]"
                  : "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] hover:border-[var(--crm-accent)] hover:bg-[var(--crm-accent-soft)]/40"
              : "cursor-default border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]/50 opacity-80",
            uploading && "pointer-events-none opacity-70",
          )}
        >
          <span
            className={cn(
              "mx-auto flex items-center justify-center shadow-sm transition-all duration-200",
              compact
                ? "h-10 w-10 rounded-full border border-[#e5e7eb] bg-[#f9fafb] text-lg text-[#8a96a8] group-hover:scale-110 group-hover:border-[#bbf7d0] group-hover:bg-[#ecfdf5] group-hover:text-[#059669]"
                : "mb-3 h-14 w-14 rounded-2xl text-2xl",
              dragOver
                ? compact
                  ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#059669]"
                  : "bg-[var(--crm-accent)] text-white"
                : !compact
                  ? "bg-[var(--crm-surface)] text-[var(--crm-accent)] group-hover:scale-105"
                  : null,
            )}
            aria-hidden
          >
            {uploading ? (
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "📐"
            )}
          </span>
          <p
            className={cn(
              "font-semibold text-[var(--crm-text-primary)] transition-colors duration-200",
              compact
                ? "text-[12px] font-bold uppercase tracking-wide text-[#8a96a8] group-hover:text-[#059669]"
                : "text-[14px]",
            )}
          >
            {uploading
              ? "Uploading floor plan…"
              : canUpload
                ? "Drop your floor plan here"
                : "No floor plan yet"}
          </p>
          {compact ? (
            <p className="text-[11px] font-medium text-[#9aa7bb] transition-colors duration-200 group-hover:text-[#059669]/80">
              max is 10 MB
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
              {canUpload
                ? `or click to browse · max ${formatMaxSize()}`
                : "Upload is available on saved CRM leads"}
            </p>
          )}
        </button>
      )}

      {canUpload && !hasFile && !compact ? (
        <p className="mt-2 text-center text-[11px] text-[var(--crm-text-muted)]">
          Drag & drop supported
        </p>
      ) : null}
    </div>
  );
}

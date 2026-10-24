"use client";

import { useCallback, useRef, useState } from "react";
import AppConfirmModal from "@/app/Components/Shared/AppConfirmModal";
import { cn } from "@/lib/cn";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  FLOOR_PLAN_ACCEPT,
  FLOOR_PLAN_MAX_BYTES,
  FLOOR_PLAN_MAX_FILES,
  floorPlanLimitMessage,
  floorPlanSlotsRemaining,
  formatFloorPlanStreamError,
  isFloorPlanImageKey,
  isFloorPlanPdfKey,
  validateFloorPlanFile,
  type FloorPlanFileRef,
} from "@/lib/floor-plan";

type Props = {
  hasFloorPlan: boolean;
  floorPlanS3Key?: string;
  /** Saved files. Index 0 is the floor plan that was already on the lead. */
  files?: FloorPlanFileRef[];
  /** Permanent public link — preferred for open in new tab. */
  publicLink?: string;
  /** Auth proxy: `/api/crm/lead/.../floor-plan/content` */
  viewHref: string;
  /** Auth proxy: `/api/crm/lead/.../floor-plan/open` */
  openHref: string;
  canUpload: boolean;
  uploading: boolean;
  onFileSelect: (files: File[]) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Called when S3 object missing — parent should clear stale floor plan state. */
  onFloorPlanMissing?: () => void;
  onRemove?: (index: number) => void | Promise<void>;
  onRemoveAll?: () => void | Promise<void>;
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

function fileKind(name: string): "pdf" | "image" | "file" {
  if (isFloorPlanPdfKey(name)) return "pdf";
  if (isFloorPlanImageKey(name)) return "image";
  return "file";
}

function kindLabel(kind: "pdf" | "image" | "file"): string {
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "IMG";
  return "FILE";
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
  files,
  publicLink = "",
  viewHref,
  openHref,
  canUpload,
  uploading,
  onFileSelect,
  onError,
  onFloorPlanMissing,
  onRemove,
  onRemoveAll,
  removing = false,
  compact = false,
  hideHeader = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openingIndex, setOpeningIndex] = useState<number | null>(null);
  const [pendingRemove, setPendingRemove] = useState<number | "all" | null>(null);
  const busy = uploading || removing;

  const savedFiles: FloorPlanFileRef[] =
    files && files.length > 0
      ? files
      : hasFloorPlan
        ? [
            {
              index: 0,
              filename: "Floor plan",
              viewPath: viewHref,
              openPath: openHref || viewHref,
            },
          ]
        : [];
  const count = savedFiles.length;
  const remaining = floorPlanSlotsRemaining(count);
  const atLimit = remaining <= 0;

  const processFiles = useCallback(
    async (list: File[]) => {
      if (!canUpload || list.length === 0) return;
      const limitError = floorPlanLimitMessage(count, list.length);
      if (limitError) {
        onError?.(limitError);
        return;
      }
      for (const file of list) {
        const err = validateFloorPlanFile(file);
        if (err) {
          onError?.(`${file.name}: ${err}`);
          return;
        }
      }
      await onFileSelect(list);
      if (inputRef.current) inputRef.current.value = "";
    },
    [canUpload, count, onError, onFileSelect],
  );

  const openPicker = () => {
    if (!busy && canUpload && !atLimit) inputRef.current?.click();
  };

  const handleOpen = (file: FloorPlanFileRef) => {
    if (openingIndex != null || busy) return;
    const href = file.openPath || file.viewPath || publicLink.trim();
    if (!href) return;
    if (publicLink.trim() && savedFiles.length === 1 && !file.viewPath.includes("index=")) {
      window.open(publicLink.trim(), "_blank", "noopener,noreferrer");
      return;
    }
    setOpeningIndex(file.index);
    void openFloorPlanInNewTab(file.openPath || file.viewPath)
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
      .finally(() => setOpeningIndex(null));
  };

  const pendingFile =
    typeof pendingRemove === "number"
      ? savedFiles.find((file) => file.index === pendingRemove)
      : undefined;

  return (
    <div className={cn(compact ? "mt-0" : "mt-4", className)}>
      {!hideHeader ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
            Floor plans
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {count > 0 ? (
              <span className="rounded-md bg-[var(--crm-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--crm-accent)]">
                {count} of {FLOOR_PLAN_MAX_FILES}
              </span>
            ) : null}
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
        multiple
        className="sr-only"
        disabled={!canUpload || busy || atLimit}
        onChange={(e) => void processFiles(Array.from(e.target.files ?? []))}
      />

      {count > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)]">
          <ul className="divide-y divide-[var(--crm-border)]">
            {savedFiles.map((file) => {
              const kind = fileKind(file.filename || floorPlanS3Key);
              const opening = openingIndex === file.index;
              return (
                <li key={`${file.index}-${file.filename}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                      kind === "pdf"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]",
                    )}
                    aria-hidden
                  >
                    {kindLabel(kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--crm-text-primary)]" title={file.filename}>
                      {file.filename || `Floor plan ${file.index + 1}`}
                    </p>
                    <p className="text-[11px] text-[var(--crm-text-muted)]">File {file.index + 1}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpen(file)}
                    disabled={opening || busy}
                    className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-semibold text-[var(--crm-accent)] hover:bg-[var(--crm-accent-soft)] disabled:opacity-50"
                  >
                    {opening ? "Opening…" : "Open"}
                  </button>
                  {canUpload && onRemove ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPendingRemove(file.index)}
                      aria-label={`Remove ${file.filename || "floor plan"}`}
                      title="Remove this file"
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
                        "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-muted)]",
                        "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
                        "disabled:pointer-events-none disabled:opacity-45",
                      )}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {canUpload ? (
            atLimit ? (
              <p className="border-t border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2.5 text-[12px] font-medium text-[var(--crm-text-muted)]">
                {FLOOR_PLAN_MAX_FILES} of {FLOOR_PLAN_MAX_FILES}. Remove one to add another.
              </p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={openPicker}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!busy) setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (busy) return;
                  void processFiles(Array.from(e.dataTransfer.files ?? []));
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-t border-dashed px-3 py-3 text-left transition",
                  dragOver
                    ? "border-[var(--crm-accent)] bg-[var(--crm-accent-soft)]"
                    : "border-[var(--crm-border)] hover:bg-[var(--crm-surface-subtle)]",
                  "disabled:opacity-60",
                )}
              >
                <span>
                  <span className="block text-[13px] font-semibold text-[var(--crm-text-primary)]">
                    {uploading ? "Adding floor plan…" : "Add another floor plan"}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--crm-text-muted)]">
                    {count} of {FLOOR_PLAN_MAX_FILES} · new files are added, not replaced · max {formatMaxSize()} each
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--crm-text-secondary)]">
                  Browse
                </span>
              </button>
            )
          ) : null}

          {canUpload && onRemoveAll && count > 1 ? (
            <div className="border-t border-[var(--crm-border)] px-3 py-2 text-right">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPendingRemove("all")}
                className="text-[12px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
              >
                Remove all
              </button>
            </div>
          ) : null}
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
            void processFiles(Array.from(e.dataTransfer.files ?? []));
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
              ? "Adding floor plan…"
              : canUpload
                ? "Drop floor plans here"
                : "No floor plan yet"}
          </p>
          {compact ? (
            <p className="text-[11px] font-medium text-[#9aa7bb] transition-colors duration-200 group-hover:text-[#059669]/80">
              Up to {FLOOR_PLAN_MAX_FILES} files · {formatMaxSize()} each
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
              {canUpload
                ? `or click to browse · up to ${FLOOR_PLAN_MAX_FILES} files · max ${formatMaxSize()} each`
                : "Upload is available on saved CRM leads"}
            </p>
          )}
        </button>
      )}

      {canUpload && count === 0 && !compact ? (
        <p className="mt-2 text-center text-[11px] text-[var(--crm-text-muted)]">
          A new upload is added to the files already on this lead.
        </p>
      ) : null}

      <AppConfirmModal
        open={pendingRemove != null}
        title={pendingRemove === "all" ? "Remove all floor plans?" : "Remove this floor plan?"}
        message={
          pendingRemove === "all"
            ? `Remove all ${count} floor plans from this lead?`
            : `Remove ${pendingFile?.filename || "this floor plan"}? The other files stay on this lead.`
        }
        confirmLabel={pendingRemove === "all" ? "Remove all" : "Remove"}
        danger
        submitting={Boolean(removing)}
        onClose={() => {
          if (!removing) setPendingRemove(null);
        }}
        onConfirm={() => {
          const target = pendingRemove;
          setPendingRemove(null);
          if (target === "all") void onRemoveAll?.();
          else if (typeof target === "number") void onRemove?.(target);
        }}
      />
    </div>
  );
}

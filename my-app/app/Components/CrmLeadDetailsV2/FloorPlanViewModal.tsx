"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  formatFloorPlanStreamError,
  isFloorPlanImageKey,
  isFloorPlanPdfKey,
} from "@/lib/floor-plan";

type Props = {
  open: boolean;
  onClose: () => void;
  floorPlanS3Key?: string;
  publicLink?: string;
  viewHref: string;
};

function getCenteredPanelPosition(panelWidth: number, panelHeight: number) {
  const x = (window.innerWidth - panelWidth) / 2;
  const y = (window.innerHeight - panelHeight) / 2;
  return clampPanelPosition(x, y, panelWidth, panelHeight);
}

function clampPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - panelWidth - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - panelHeight - margin),
  };
}

export default function FloorPlanViewModal({
  open,
  onClose,
  floorPlanS3Key = "",
  publicLink = "",
  viewHref,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blobUrlRef = useRef("");

  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewKind, setPreviewKind] = useState<"image" | "pdf" | "unknown">("unknown");

  const key = floorPlanS3Key.trim();
  const publicHref = publicLink.trim();

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPanelPosition(getCenteredPanelPosition(rect.width, rect.height));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panelWidth = Math.min(920, window.innerWidth - 32);
    const estimatedHeight = Math.min(640, window.innerHeight - 48);
    setPanelPosition(getCenteredPanelPosition(panelWidth, estimatedHeight));
    setPanelEntered(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl("");
      setPreviewKind("unknown");
      setError(null);
      setLoading(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const isImage = isFloorPlanImageKey(key || publicHref);
    const isPdf = isFloorPlanPdfKey(key || publicHref);
    setPreviewKind(isImage ? "image" : isPdf ? "pdf" : "unknown");

    void (async () => {
      try {
        if (isImage && publicHref) {
          if (!cancelled) setPreviewUrl(publicHref);
          return;
        }

        if (!viewHref) {
          throw new Error("Floor plan preview is not available.");
        }

        const res = await fetch(viewHref, {
          credentials: "include",
          headers: getCrmAuthHeaders(),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(formatFloorPlanStreamError(`HTTP ${res.status}`));
        }
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPreviewUrl(blobUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load floor plan.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [open, viewHref, publicHref, key]);

  const closePanel = useCallback(() => {
    setPanelEntered(false);
    window.setTimeout(() => onClose(), 280);
  }, [onClose]);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const rect = panelRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    const next = clampPanelPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
      rect.width,
      rect.height,
    );

    panelRef.current.style.left = `${next.x}px`;
    panelRef.current.style.top = `${next.y}px`;
    setPanelPosition(next);
  }, []);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={closePanel}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`fixed z-[95] flex max-h-[calc(100vh-4rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
        }`}
        style={{ left: panelPosition.x, top: panelPosition.y }}
        role="dialog"
        aria-modal="true"
        aria-label="Floor plan preview"
      >
        <div
          className={`flex items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f0f8] text-[#4b6b8a]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
              Floor Plan
            </h2>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] hover:bg-[#f3f4f6]"
            aria-label="Close floor plan preview"
          >
            ×
          </button>
        </div>

        <div className="min-h-[320px] flex-1 overflow-auto bg-[#f8fafc] p-4">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-[#4b6b8a] border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-[12px] text-rose-600">{error}</p>
          ) : previewKind === "image" && previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Floor plan"
              className="mx-auto max-h-[calc(100vh-12rem)] w-full object-contain"
            />
          ) : previewKind === "pdf" && previewUrl ? (
            <iframe
              title="Floor plan PDF"
              src={previewUrl}
              className="h-[calc(100vh-12rem)] min-h-[420px] w-full rounded-lg border border-[#e5e7eb] bg-white"
            />
          ) : previewUrl ? (
            <iframe
              title="Floor plan document"
              src={previewUrl}
              className="h-[calc(100vh-12rem)] min-h-[420px] w-full rounded-lg border border-[#e5e7eb] bg-white"
            />
          ) : (
            <p className="text-[12px] text-[#9ca3af]">No preview available.</p>
          )}
        </div>
      </div>
    </>
  );
}

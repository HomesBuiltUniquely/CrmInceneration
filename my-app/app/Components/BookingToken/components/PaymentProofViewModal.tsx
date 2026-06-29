"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type Props = {
  open: boolean;
  onClose: () => void;
  fileName: string;
  mimeType?: string;
  /** Already-loaded blob URL (from thumbnail). */
  previewUrl?: string;
  /** BFF URL to fetch when previewUrl is not provided. */
  viewHref?: string;
};

export default function PaymentProofViewModal({
  open,
  onClose,
  fileName,
  mimeType,
  previewUrl: previewUrlProp,
  viewHref,
}: Props) {
  const blobUrlRef = useRef("");
  const ownsBlobRef = useRef(false);

  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const isPdf = mimeType?.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isImage =
    mimeType?.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(fileName);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl("");
      setError(null);
      setLoading(false);
      if (ownsBlobRef.current && blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
        ownsBlobRef.current = false;
      }
      return;
    }

    if (previewUrlProp) {
      setPreviewUrl(previewUrlProp);
      setLoading(false);
      setError(null);
      return;
    }

    if (!viewHref) {
      setError("Payment proof preview is not available.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreviewUrl("");

    void (async () => {
      try {
        const res = await fetch(viewHref, {
          credentials: "include",
          headers: getCrmAuthHeaders(),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Unable to load proof (${res.status})`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        ownsBlobRef.current = true;
        setPreviewUrl(blobUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load payment proof.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (ownsBlobRef.current && blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
        ownsBlobRef.current = false;
      }
    };
  }, [open, previewUrlProp, viewHref]);

  const closePanel = useCallback(() => {
    setEntered(false);
    window.setTimeout(() => onClose(), 220);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, closePanel]);

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={closePanel}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-3 z-[115] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl transition-all duration-300 sm:inset-4 md:inset-6 ${
          entered ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Payment proof preview"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400">
              Payment proof
            </p>
            <p className="truncate text-sm text-white/90" title={fileName}>
              {fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="bt-btn bt-btn-modal-close-dark"
            aria-label="Close payment proof preview"
          >
            ×
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-5">
          {loading ? (
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : isImage && previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt={fileName}
              className="max-h-full max-w-full object-contain"
              style={{ maxHeight: "calc(100vh - 7rem)" }}
            />
          ) : isPdf && previewUrl ? (
            <iframe
              title={fileName}
              src={previewUrl}
              className="h-full min-h-[70vh] w-full rounded-lg bg-white"
            />
          ) : previewUrl ? (
            <iframe
              title={fileName}
              src={previewUrl}
              className="h-full min-h-[70vh] w-full rounded-lg bg-white"
            />
          ) : (
            <p className="text-sm text-white/60">No preview available.</p>
          )}
        </div>
      </div>
    </>
  );
}

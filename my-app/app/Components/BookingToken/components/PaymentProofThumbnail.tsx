"use client";

import { useEffect, useRef, useState } from "react";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { paymentProofViewUrl } from "@/lib/booking-payment-history-api";
import PaymentProofViewModal from "./PaymentProofViewModal";

type Props = {
  recordId: string;
  proofId: string;
  fileName: string;
  mimeType?: string;
};

export default function PaymentProofThumbnail({ recordId, proofId, fileName, mimeType }: Props) {
  const blobUrlRef = useRef("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  const href = paymentProofViewUrl(recordId, proofId);
  const isPdf = mimeType?.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPreviewUrl("");

    void (async () => {
      try {
        const res = await fetch(href, {
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
        setPreviewUrl(blobUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load proof.");
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
  }, [href]);

  if (loading) {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] text-[11px] text-[#9ca3af]">
        Loading…
      </div>
    );
  }

  if (error || !previewUrl) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2 py-3 text-[11px] text-[#9ca3af]">
        {error || "Preview unavailable"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="w-full overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb] text-left hover:border-[#059669]"
        title="Click to view full size"
      >
        {isPdf ? (
          <div className="flex h-28 items-center justify-center text-[11px] font-semibold text-[#374151]">
            PDF · Click to open
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={previewUrl} alt={fileName} className="h-28 w-full object-cover" />
        )}
        <p className="truncate px-2 py-1 text-[10px] text-[#6b7280]">{fileName}</p>
      </button>

      <PaymentProofViewModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fileName={fileName}
        mimeType={mimeType}
        previewUrl={previewUrl}
      />
    </>
  );
}

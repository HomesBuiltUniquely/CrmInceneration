"use client";

import { useEffect, useRef, useState } from "react";
import FloorPlanViewModal from "./FloorPlanViewModal";
import {
  FLOOR_PLAN_ACCEPT,
  FLOOR_PLAN_MAX_BYTES,
  floorPlanDisplayFileName,
  leadHasFloorPlan,
  readStoredFloorPlanOriginalName,
  validateFloorPlanFile,
  writeStoredFloorPlanOriginalName,
} from "@/lib/floor-plan";

type Props = {
  leadType: string;
  leadId: string;
  floorPlanS3Key: string;
  floorPlanPublicLink: string;
  floorPlanViewPath: string;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onError?: (message: string) => void;
};

function formatMaxSize(): string {
  const mb = FLOOR_PLAN_MAX_BYTES / (1024 * 1024);
  return `${mb}MB`;
}

export default function ConfigurationScopeFloorPlan({
  leadType,
  leadId,
  floorPlanS3Key,
  floorPlanPublicLink,
  floorPlanViewPath,
  uploading,
  onUpload,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const hasFloorPlan = leadHasFloorPlan(floorPlanS3Key, undefined, floorPlanPublicLink);
  const storedFileName = readStoredFloorPlanOriginalName(leadType, leadId);
  const displayFileName =
    uploadedFileName.trim() ||
    storedFileName ||
    floorPlanDisplayFileName(floorPlanS3Key, floorPlanPublicLink);

  useEffect(() => {
    const saved = readStoredFloorPlanOriginalName(leadType, leadId);
    if (saved) setUploadedFileName(saved);
  }, [leadType, leadId]);

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  const processFile = async (file: File | null) => {
    if (!file || uploading) return;
    const err = validateFloorPlanFile(file);
    if (err) {
      onError?.(err);
      return;
    }
    const originalName = file.name.trim();
    setUploadedFileName(originalName);
    writeStoredFloorPlanOriginalName(leadType, leadId, originalName);
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={FLOOR_PLAN_ACCEPT}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => void processFile(e.target.files?.[0] ?? null)}
      />

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-dashed border-[#cfd6e0] bg-white">
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className={`group flex min-h-[120px] flex-col items-center justify-center border-r border-dashed border-[#cfd6e0] px-4 py-6 text-center transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f8fafc] hover:shadow-sm active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0`}
        >
          <span
            className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] text-lg text-[#8a96a8] transition-all duration-200 group-hover:scale-110 group-hover:border-[#bbf7d0] group-hover:bg-[#ecfdf5] group-hover:text-[#059669]"
            aria-hidden="true"
          >
            {uploading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "📐"
            )}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#4b6b8a] transition-colors duration-200 group-hover:text-[#059669]">
            {uploading ? "Uploading…" : "Upload New Plan"}
          </p>
          <p className="mt-1 text-[10px] text-[#9ca3af] transition-colors duration-200 group-hover:text-[#059669]/80">
            PDF, JPG, PNG (Max {formatMaxSize()})
          </p>
        </button>

        <button
          type="button"
          onClick={() => setViewOpen(true)}
          disabled={!hasFloorPlan || !floorPlanViewPath}
          className="group flex min-h-[120px] flex-col items-center justify-center px-4 py-6 text-center transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f8fafc] hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <span
            className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] text-[#8a96a8] transition-all duration-200 group-hover:scale-110 group-hover:border-[#bbf7d0] group-hover:bg-[#ecfdf5] group-hover:text-[#059669] disabled:group-hover:scale-100 disabled:group-hover:border-[#e5e7eb] disabled:group-hover:bg-[#f9fafb] disabled:group-hover:text-[#8a96a8]"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#4b6b8a] transition-colors duration-200 group-hover:text-[#059669]">
            View Floor Plan
          </p>
          <p className="mt-1 text-[10px] text-[#9ca3af] transition-colors duration-200 group-hover:text-[#059669]/80">
            {hasFloorPlan ? "Tap to preview" : "No file uploaded"}
          </p>
          {hasFloorPlan && displayFileName ? (
            <p
              className="mt-1 max-w-full truncate px-1 text-[10px] font-semibold text-[#6b7280]"
              title={displayFileName}
            >
              {displayFileName}
            </p>
          ) : null}
        </button>
      </div>

      <FloorPlanViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        floorPlanS3Key={floorPlanS3Key}
        publicLink={floorPlanPublicLink}
        viewHref={floorPlanViewPath}
      />
    </>
  );
}

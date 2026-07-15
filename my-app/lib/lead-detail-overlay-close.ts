"use client";

/** Dispatch to close lead-detail overlay (runs auto-save via modal onBeforeClose). */
export const LEAD_DETAIL_OVERLAY_CLOSE_EVENT = "crm-lead-detail-overlay-close";

export function requestLeadDetailOverlayClose(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEAD_DETAIL_OVERLAY_CLOSE_EVENT));
}

/** True when double-click landed on empty chrome (not a control / link / input). */
export function isEmptySpaceDoubleClickTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(
    "button, a, input, select, textarea, label, option, [role='button'], [role='link'], [role='menuitem'], [contenteditable='true'], [data-no-dblclick-close]",
  );
  return !interactive;
}

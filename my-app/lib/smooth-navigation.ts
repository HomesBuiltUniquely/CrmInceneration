/** iOS-style easing — smooth deceleration without bounce. */
export const CRM_MOTION_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

/** Wrap navigation in the browser View Transitions API when available. */
export function smoothNavigate(navigate: () => void | Promise<void>): void {
  if (typeof window === "undefined") {
    void navigate();
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    void navigate();
    return;
  }

  const doc = document as DocumentWithViewTransition;
  if (doc.startViewTransition) {
    doc.startViewTransition(() => navigate());
    return;
  }

  void navigate();
}

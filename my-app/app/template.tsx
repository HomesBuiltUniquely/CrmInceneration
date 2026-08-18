"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function useViewTransitionsSupported() {
  return useSyncExternalStore(
    () => () => {},
    () => typeof document !== "undefined" && "startViewTransition" in document,
    () => false,
  );
}

/** Soft page enter when the browser has no View Transitions API. */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const viewTransitions = useViewTransitionsSupported();
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (isLogin || reducedMotion || viewTransitions) {
    return <>{children}</>;
  }

  return (
    <div key={pathname} className="crm-page-transition">
      {children}
    </div>
  );
}

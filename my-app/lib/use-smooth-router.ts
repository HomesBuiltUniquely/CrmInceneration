"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { smoothNavigate } from "@/lib/smooth-navigation";

/** Drop-in router wrapper — use for sidebar / module navigation. */
export function useSmoothRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      push: (href: string) => smoothNavigate(() => router.push(href)),
      replace: (href: string) => smoothNavigate(() => router.replace(href)),
      back: () => smoothNavigate(() => router.back()),
      forward: () => smoothNavigate(() => router.forward()),
      refresh: () => router.refresh(),
      prefetch: router.prefetch.bind(router),
    }),
    [router],
  );
}

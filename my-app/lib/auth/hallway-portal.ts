/**
 * Production: CRM login UI is retired — users authenticate via Hallway,
 * then hand off into CRM (`/auth/accept#payload=...`).
 *
 * Localhost / 127.0.0.1: keep CRM `/login` for local development.
 *
 * Override Hallway URL with NEXT_PUBLIC_HALLWAY_URL when needed.
 */
export const HALLWAY_PORTAL_URL = (
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_HALLWAY_URL?.trim()
    ? process.env.NEXT_PUBLIC_HALLWAY_URL.trim()
    : "https://hallway-liart.vercel.app/"
).replace(/\/?$/, "/");

/** True when CRM is served from a local host (dev). */
export function isLocalCrmHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.trim().toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

/**
 * Unauthenticated / logout entry:
 * - localhost → CRM `/login`
 * - deployed → Hallway portal
 */
export function redirectToAuthEntry(): void {
  if (typeof window === "undefined") return;
  if (isLocalCrmHost()) {
    window.location.replace(`${window.location.origin}/login`);
    return;
  }
  window.location.replace(HALLWAY_PORTAL_URL);
}

/** @deprecated Use redirectToAuthEntry — keeps Hallway name for call sites. */
export function redirectToHallwayPortal(): void {
  redirectToAuthEntry();
}

/**
 * CRM login UI is retired — users authenticate via Hallway Digital Corridor,
 * then hand off into CRM (`/auth/accept#payload=...`).
 *
 * Override with NEXT_PUBLIC_HALLWAY_URL when needed.
 */
export const HALLWAY_PORTAL_URL = (
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_HALLWAY_URL?.trim()
    ? process.env.NEXT_PUBLIC_HALLWAY_URL.trim()
    : "https://hallway-liart.vercel.app/"
).replace(/\/?$/, "/");

/** Hard-navigate to Hallway (logout / no session / /login). */
export function redirectToHallwayPortal(): void {
  if (typeof window === "undefined") return;
  window.location.replace(HALLWAY_PORTAL_URL);
}

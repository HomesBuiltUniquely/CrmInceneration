/**
 * CRM backend origin without a trailing slash.
 * Uses BASE_URL from environment with production fallback.
 */
export const CRM_API_BASE_URL = (
  process.env.BASE_URL?.trim() || "https://hows.hubinterior.com"
).replace(/\/+$/, "");

/** Backward-compatible alias for existing imports. */
export const BASE_URL = CRM_API_BASE_URL;
/**
 * CRM backend origin without a trailing slash.
 * Hardcoded to production Hub API as requested.
 */
export const CRM_API_BASE_URL = "https://api.hubinterior.com".replace(
  /\/$/,
  "",
);

/** Backward-compatible alias for existing imports. */
export const BASE_URL = CRM_API_BASE_URL;
/**
 * CRM backend origin without a trailing slash.
 * Hardcoded to production HOWS backend as requested.
 */
export const CRM_API_BASE_URL = "https://hows.hubinterior.com".replace(
  /\/$/,
  "",
);

/** Backward-compatible alias for existing imports. */
export const BASE_URL = CRM_API_BASE_URL;
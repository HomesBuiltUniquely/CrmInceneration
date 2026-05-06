/**
 * CRM backend origin without a trailing slash.
 * Hardcoded to production Hub API as requested.
 */
export const BASE_URL = "https://api.hubinterior.com".replace(
  /\/$/,
  "",
);

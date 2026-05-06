/**
 * CRM backend origin without a trailing slash.
 * Set `BASE_URL` in `.env.local` (e.g. http://localhost:8081).
 */
export const BASE_URL = ("https://api.hubinterior.com" ?? "http://localhost:8081").replace(
  /\/$/,
  "",
);

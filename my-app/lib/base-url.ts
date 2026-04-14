/**
 * CRM backend origin without a trailing slash.
 * Set `BASE_URL` in `.env.local` (e.g. http://localhost:8081).
 */
export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8081").replace(
  /\/$/,
  "",
);

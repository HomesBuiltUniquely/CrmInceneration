import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

/** App root (`my-app/`) — Turbopack scope when the repo has multiple lockfiles. */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Do not set `outputFileTracingRoot` here — Vercel sets it during deploy. Setting it
  // locally caused ENOENT for `.next/routes-manifest-deterministic.json` at `/vercel/path0`.
  turbopack: {
    root: appRoot,
  },
  /** Expose `BASE_URL` to client bundles (same name as `.env.local`). */
  env: {
    BASE_URL: process.env.BASE_URL ?? "http://localhost:8081",
    /**
     * Go NotifyProject server — server-side only (no NEXT_PUBLIC_ prefix).
     * Fallback keeps local dev working even if .env.local is missing.
     * Override in production via the NOTIFY_API_URL environment variable.
     */
    NOTIFY_API_URL: process.env.NOTIFY_API_URL ?? "http://localhost:8083",
  },
};

export default nextConfig;

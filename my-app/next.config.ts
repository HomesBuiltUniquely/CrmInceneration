import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

/** App root (`my-app/`) — must match for Turbopack + Vercel file tracing. */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  turbopack: {
    // Keep Next/Turbopack scoped to this app folder when repo has multiple lockfiles.
    root: appRoot,
  },
  /** Expose `BASE_URL` to client bundles (same name as `.env.local`). */
  env: {
    BASE_URL: process.env.BASE_URL ?? "http://localhost:8081",
  },
};

export default nextConfig;

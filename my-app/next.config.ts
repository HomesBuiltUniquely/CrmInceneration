import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Next/Turbopack scoped to this app folder when repo has multiple lockfiles.
    root: process.cwd(),
  },
  /** Expose `BASE_URL` to client bundles (same name as `.env.local`). */
  env: {
    BASE_URL: process.env.BASE_URL ?? "http://localhost:8081",
  },
};

export default nextConfig;

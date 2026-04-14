import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /** Expose `BASE_URL` to client bundles (same name as `.env.local`). */
  env: {
    BASE_URL: process.env.BASE_URL ?? "http://localhost:8081",
  },
};

export default nextConfig;

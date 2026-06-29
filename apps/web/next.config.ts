import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root to the monorepo (this app sits in apps/web). Without this
// Next can pick up an unrelated lockfile in a parent directory and warn.
const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: resolve(here, "../..") },
};

export default nextConfig;

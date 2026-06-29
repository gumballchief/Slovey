import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root to the monorepo (this app sits in apps/web). Without this
// Next can pick up an unrelated lockfile in a parent directory and warn.
const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Standalone: emit a minimal server bundling only traced deps, so the runtime
  // image is small and fits well within a 512MB instance (plain `next start`
  // loads the whole workspace + node_modules and OOMs there).
  output: "standalone",
  outputFileTracingRoot: resolve(here, "../.."),
  turbopack: { root: resolve(here, "../..") },
};

export default nextConfig;

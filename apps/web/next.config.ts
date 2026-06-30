import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root to the monorepo (this app sits in apps/web). Without this
// Next can pick up an unrelated lockfile in a parent directory and warn.
const here = dirname(fileURLToPath(import.meta.url));

// Secrets live in the monorepo-root .env (shared by web/worker/db). Next only
// auto-loads its own app-dir .env, so load the root one here — required so the
// NEXT_PUBLIC_* vars below are inlined into the client bundle.
loadDotenv({ path: resolve(here, "../../.env") });

const nextConfig: NextConfig = {
  // Expose the public Supabase vars to the browser (read from the root .env above).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
  // Standalone: emit a minimal server bundling only traced deps, so the runtime
  // image is small and fits well within a 512MB instance (plain `next start`
  // loads the whole workspace + node_modules and OOMs there).
  output: "standalone",
  outputFileTracingRoot: resolve(here, "../.."),
  turbopack: { root: resolve(here, "../..") },
};

export default nextConfig;

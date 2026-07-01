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
  experimental: {
    // Bound the static-generation footprint. Next otherwise forks ~1 prerender
    // worker per CPU (~15 here), each a full Node process (~150-200MB); on a
    // memory-tight machine that OOMs mid-prerender, and a dying worker surfaces
    // as React "useContext of null" / "reading 'length' of undefined" crashes on
    // the error-page and dashboard shells. `cpus: 1` pins Next to a single
    // worker (getNumberOfWorkers reads experimental.cpus as a hard override),
    // maxConcurrency:1 renders one page at a time within it, and retryCount
    // covers any residual transient. Only ~20 pages, prerendered in <2s, so the
    // serial cost is negligible.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
  },
};

export default nextConfig;

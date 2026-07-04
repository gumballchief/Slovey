import { build } from "esbuild";
import { writeFileSync } from "node:fs";

/**
 * Bundle the CLI + MCP server into standalone files for npm distribution.
 * Strategy: inline the @company-brain/* workspace SOURCE (that's what removes the
 * un-publishable `workspace:*` deps), but keep real npm packages EXTERNAL — they're
 * declared in the emitted dist/package.json and installed by npm. Externalizing
 * avoids bundling dynamic-require-heavy deps (pg-boss, postgres) into ESM.
 */
const externalizeNpm = {
  name: "externalize-npm",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("@company-brain/")) return undefined; // bundle workspace source
      return { path: args.path, external: true };
    });
  },
};

const banner = {
  // esbuild hoists the entry's own shebang to line 1 — don't add a second.
  // Provide a require()/__dirname shim (some deps expect CJS globals in ESM).
  js: "import { createRequire as __cr } from 'node:module';\nimport { fileURLToPath as __f } from 'node:url';\nimport { dirname as __d } from 'node:path';\nconst require = __cr(import.meta.url);\nconst __filename = __f(import.meta.url);\nconst __dirname = __d(__filename);",
};

const common = { bundle: true, platform: "node", format: "esm", target: "node18", plugins: [externalizeNpm], banner, logLevel: "info" };

await build({ ...common, entryPoints: ["src/cli.ts"], outfile: "dist/cli.mjs" });
await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.mjs" });

// Publishable manifest — real deps (workspace packages are inlined, so they're gone).
const pkg = {
  name: "companybrain",
  version: "0.1.0",
  description: "Company Brain — run engineering-decision + build/security preflight checks before your AI agent commits.",
  type: "module",
  bin: { companybrain: "cli.mjs", "company-brain-mcp": "index.mjs" },
  files: ["cli.mjs", "index.mjs"],
  engines: { node: ">=18" },
  dependencies: {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@octokit/app": "^15.1.6",
    "@octokit/rest": "^21.1.1",
    "@octokit/webhooks": "^13.6.1",
    dotenv: "^16.4.5",
    "drizzle-orm": "^0.36.4",
    "pg-boss": "^10.1.6",
    postgres: "^3.4.5",
    zod: "^3.23.8",
  },
};
writeFileSync("dist/package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log("built dist/cli.mjs + dist/index.mjs + dist/package.json");

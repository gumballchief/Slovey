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
// NOTE: the package name is `slovey`. Do NOT publish as `companybrain` — that name is
// already owned by an unrelated publisher on npm (same squatter trap as the GitHub App slug).
const pkg = {
  name: "slovey",
  version: "0.1.1",
  description: "Slovey — the decision memory your AI coding agent doesn't have. Blocks commits that contradict what your team already decided.",
  type: "module",
  // No `companybrain` bin: an unrelated package of that name exists on npm, and a
  // user with both installed would hit a global bin collision. `company-brain-mcp`
  // is kept for back-compat with existing MCP client configs.
  bin: { slovey: "cli.mjs", "slovey-mcp": "index.mjs", "company-brain-mcp": "index.mjs" },
  files: ["cli.mjs", "index.mjs", "README.md"],
  keywords: ["ai", "agents", "coding-agent", "preflight", "code-review", "mcp", "architecture-decision-records", "adr", "claude", "cursor"],
  homepage: "https://slovey.dev",
  repository: { type: "git", url: "git+https://github.com/gumballchief/slovey.git" },
  license: "MIT",
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

// npm renders this on the package page — without it the listing looks abandoned.
const readme = `# Slovey

Your AI coding agent has no memory of what your team already decided. Slovey gives it one,
and blocks the commit when a change contradicts a decision that's already been made.

## Install

\`\`\`bash
npm install -g slovey
\`\`\`

Or run it without installing:

\`\`\`bash
npx slovey@latest doctor
\`\`\`

## Setup

1. Sign in at [slovey.dev](https://slovey.dev) and connect your repository.
2. Go to **Preflight → CLI Tokens** and mint a token.
3. Export it:

\`\`\`bash
export SLOVEY_TOKEN=cb_your_token_here
\`\`\`

4. Check your setup:

\`\`\`bash
slovey doctor
\`\`\`

## Usage

\`\`\`bash
slovey preflight                 # human-readable report
slovey preflight --json          # machine-readable, for agents and CI
slovey preflight --fix-agent     # fix instructions only, for your agent to consume
slovey preflight --install-hooks # gate every commit and push automatically
\`\`\`

Exit code is \`0\` when it's safe to commit, \`1\` otherwise — so it drops straight into CI.

## What runs where

| Check | Local CLI | Hosted API |
|---|---|---|
| Decision-graph check | ✅ | ✅ |
| Architecture rules | ✅ | ✅ |
| Secret scan | ✅ | ✅ |
| AI security review | ✅ | ✅ |
| Typecheck / test / build | ✅ | reported as skipped |

Command checks run on your machine by design — Slovey does not execute your build or test
commands on our servers.

## Overriding a block

Blocks are meant to be contestable. A human — not an agent — can time-box an override:

\`\`\`bash
slovey preflight override <decisionId> --reason "why this is correct now"
\`\`\`

Overrides are attributed and expire.

## License

MIT · [slovey.dev](https://slovey.dev) · [github.com/gumballchief/slovey](https://github.com/gumballchief/slovey)
`;
writeFileSync("dist/README.md", readme);

console.log("built dist/cli.mjs + dist/index.mjs + dist/package.json + dist/README.md");
console.log("publish with:  cd dist && npm publish --access public");

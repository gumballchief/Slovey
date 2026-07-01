#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { preflight, resolveRepo } from "@company-brain/core";

type PreflightResult = preflight.PreflightResult;

const HELP = `companybrain preflight — run the agent-gating checks on this repo.

Usage:
  companybrain preflight                 human-readable report
  companybrain preflight --json          machine-readable JSON (for agents/CI)
  companybrain preflight --fix-agent     agent-directed fix instructions only
  companybrain preflight --check-only    static + command checks, skip decision graph
  companybrain preflight --max-attempts 5
  companybrain preflight --install-hooks install pre-commit + pre-push git hooks

Exit code: 0 if safe to commit, 1 otherwise.`;

function parseSlug(gitUrl: string): string | null {
  const m = gitUrl.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

async function resolveRepoId(cwd: string): Promise<string | null> {
  try {
    let slug = process.env.COMPANY_BRAIN_REPO ?? null;
    if (!slug) {
      const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8" }).trim();
      slug = parseSlug(url);
    }
    if (!slug) return null;
    const r = await resolveRepo(slug);
    return r?.repoId ?? null;
  } catch {
    return null; // no DB / no remote → run command+static checks only
  }
}

function installHooks(cwd: string): void {
  const hooksDir = resolve(cwd, ".git", "hooks");
  if (!existsSync(resolve(cwd, ".git"))) {
    console.error("Not a git repository (no .git). Run this from the repo root.");
    process.exit(1);
  }
  mkdirSync(hooksDir, { recursive: true });
  const hook = (args: string) => `#!/bin/sh
# Company Brain Preflight — installed by 'companybrain preflight --install-hooks'
if command -v companybrain >/dev/null 2>&1; then
  companybrain preflight ${args}
  exit $?
fi
echo "[company-brain] 'companybrain' CLI not on PATH — Preflight skipped."
exit 0
`;
  for (const [name, args] of [["pre-commit", "--check-only"], ["pre-push", ""]] as const) {
    const p = resolve(hooksDir, name);
    writeFileSync(p, hook(args), { mode: 0o755 });
    try {
      chmodSync(p, 0o755);
    } catch {
      /* Windows: mode is a no-op */
    }
    console.log(`installed ${name} hook → ${p}`);
  }
  console.log("\nDone. Commits now run Preflight (--check-only); pushes run the full gate.");
  console.log("If 'companybrain' isn't on your PATH, the hooks skip gracefully — install/link the CLI to enforce.");
}

function printHuman(r: PreflightResult): void {
  const mark = r.status === "pass" ? "PASS ✓" : "FAIL ✗";
  console.log(`\nPreflight: ${mark} — ${r.summary}`);
  console.log(`safe to commit: ${r.safeToCommit ? "YES" : "NO"}  ·  attempt ${r.attempt}/${r.maxAttempts}${r.humanReviewRequired ? "  ·  HUMAN REVIEW REQUIRED" : ""}\n`);
  for (const c of r.checks) {
    const s = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–";
    console.log(`  ${s} ${c.name.padEnd(16)} ${c.status.padEnd(8)} ${c.durationMs}ms${c.skippedReason ? `  (${c.skippedReason})` : ""}`);
  }
  if (r.decisionViolations.length) {
    console.log("\nDecision violations:");
    for (const v of r.decisionViolations) console.log(`  ! ${v.title} — ${v.violation}`);
  }
  if (r.fixInstructions.length) {
    console.log("\nFix instructions (highest priority first):");
    for (const f of r.fixInstructions.slice(0, 20)) console.log(`  • [${f.priority}] ${f.file || "(general)"}: ${f.problem}`);
  }
  console.log(`\n${r.agentGuidance}\n`);
}

function printAgent(r: PreflightResult): void {
  console.log(
    JSON.stringify(
      {
        safeToCommit: r.safeToCommit,
        agentGuidance: r.agentGuidance,
        humanReviewRequired: r.humanReviewRequired,
        fixInstructions: r.fixInstructions,
        decisionViolations: r.decisionViolations,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "preflight"); // allow "companybrain preflight ..."
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const cwd = process.env.COMPANY_BRAIN_REPO_PATH || process.cwd();
  if (argv.includes("--install-hooks")) {
    installHooks(cwd);
    return;
  }
  const maxIdx = argv.indexOf("--max-attempts");
  const maxAttempts = maxIdx >= 0 && argv[maxIdx + 1] ? Number(argv[maxIdx + 1]) : undefined;

  const repoId = await resolveRepoId(cwd);
  const r = await preflight.runPreflight({
    cwd,
    repoId,
    checkOnly: argv.includes("--check-only"),
    maxAttempts,
  });

  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else if (argv.includes("--fix-agent")) printAgent(r);
  else printHuman(r);

  process.exit(r.safeToCommit ? 0 : 1);
}

main().catch((e) => {
  console.error(`preflight failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});

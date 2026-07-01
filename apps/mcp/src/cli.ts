#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { preflight, resolveRepo } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

type PreflightResult = preflight.PreflightResult;

const HELP = `companybrain preflight — run the agent-gating checks on this repo.

Usage:
  companybrain preflight                    human-readable report (mode: full)
  companybrain preflight --json             machine-readable JSON (for agents/CI)
  companybrain preflight --fix-agent        agent-directed fix instructions only
  companybrain preflight --mode <m>         full | quick | commit | push | changed-files | planning
  companybrain preflight --check-only       skip the decision-graph check
  companybrain preflight --changed-files    scope file checks to git-changed files (default behavior, explicit)
  companybrain preflight --max-attempts 5
  companybrain preflight init               write a starter companybrain.preflight.json
  companybrain preflight status             show the latest run without re-running
  companybrain preflight explain <errorId>  explain one stored error (id from fixInstructions)
  companybrain preflight --install-hooks    install pre-commit (mode: commit) + pre-push (full) git hooks
  companybrain preflight --uninstall-hooks  remove Company Brain git hooks

Exit code: 0 if safe to commit, 1 otherwise.`;

const HOOK_MARKER = "# Company Brain Preflight";

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

function hooksDir(cwd: string): string {
  if (!existsSync(resolve(cwd, ".git"))) {
    console.error("Not a git repository (no .git). Run this from the repo root.");
    process.exit(1);
  }
  const dir = resolve(cwd, ".git", "hooks");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function installHooks(cwd: string): void {
  const dir = hooksDir(cwd);
  const hook = (args: string) => `#!/bin/sh
${HOOK_MARKER} — installed by 'companybrain preflight --install-hooks'
if command -v companybrain >/dev/null 2>&1; then
  companybrain preflight ${args}
  exit $?
fi
echo "[company-brain] 'companybrain' CLI not on PATH — Preflight skipped."
exit 0
`;
  for (const [name, args] of [["pre-commit", "--mode commit"], ["pre-push", "--mode push"]] as const) {
    const p = resolve(dir, name);
    writeFileSync(p, hook(args), { mode: 0o755 });
    try {
      chmodSync(p, 0o755);
    } catch {
      /* Windows: mode is a no-op */
    }
    console.log(`installed ${name} hook → ${p}`);
  }
  console.log("\nDone. Commits run the fast gate (mode: commit); pushes run the full gate.");
  console.log("If 'companybrain' isn't on your PATH, the hooks skip gracefully — install/link the CLI to enforce.");
}

function uninstallHooks(cwd: string): void {
  const dir = hooksDir(cwd);
  for (const name of ["pre-commit", "pre-push"]) {
    const p = resolve(dir, name);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf8");
    if (content.includes(HOOK_MARKER)) {
      rmSync(p);
      console.log(`removed ${name} hook`);
    } else {
      console.log(`skipped ${name}: not installed by Company Brain`);
    }
  }
}

function initConfig(cwd: string): void {
  const target = resolve(cwd, preflight.CONFIG_FILENAME);
  if (existsSync(target)) {
    console.log(`${preflight.CONFIG_FILENAME} already exists — not overwriting.`);
    return;
  }
  writeFileSync(target, preflight.defaultConfigJson());
  console.log(`wrote ${target}`);
  console.log("Edit requiredChecks/commands/architectureChecks.rules to fit this repo.");
}

function printHuman(r: PreflightResult): void {
  const mark = r.status === "pass" ? "PASS ✓" : r.status === "partial" ? "PARTIAL ◐" : "FAIL ✗";
  console.log(`\nPreflight: ${mark} — ${r.summary}  (mode: ${r.mode})`);
  console.log(
    `safe to commit: ${r.safeToCommit ? "YES" : "NO"} · safe to push: ${r.safeToPush ? "YES" : "NO"} · attempt ${r.attempt.attemptNumber}/${r.attempt.maxAttempts}${r.humanReviewRequired ? " · HUMAN REVIEW REQUIRED" : ""}\n`,
  );
  for (const c of r.checks) {
    const s = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–";
    console.log(`  ${s} ${c.name.padEnd(19)} ${c.status.padEnd(8)} ${String(c.durationMs).padStart(6)}ms${c.blocking ? "  [blocking]" : ""}${c.skippedReason ? `  (${c.skippedReason})` : ""}`);
  }
  if (r.decisionViolations.length) {
    console.log("\nDecision violations:");
    for (const v of r.decisionViolations) console.log(`  ! [${v.decisionStatus}] ${v.title} — ${v.violation}`);
  }
  if (r.fixInstructions.length) {
    console.log("\nFix instructions (highest priority first):");
    for (const f of r.fixInstructions.slice(0, 20)) console.log(`  • [${f.priority}] ${f.file || "(general)"}: ${f.problem}  (id: ${f.id})`);
  }
  for (const w of r.warnings) console.log(`\n⚠ ${w}`);
  console.log(`\n${r.agentInstruction}\n`);
}

function printAgent(r: PreflightResult): void {
  console.log(
    JSON.stringify(
      {
        safeToCommit: r.safeToCommit,
        safeToPush: r.safeToPush,
        agentInstruction: r.agentInstruction,
        humanReviewRequired: r.humanReviewRequired,
        attempt: r.attempt,
        fixInstructions: r.fixInstructions,
        decisionViolations: r.decisionViolations,
        warnings: r.warnings,
        nextSteps: r.nextSteps,
      },
      null,
      2,
    ),
  );
}

async function showStatus(cwd: string): Promise<void> {
  const repoId = await resolveRepoId(cwd);
  if (!repoId) {
    console.log("No connected repo — status is only stored for repos connected to Company Brain.");
    return;
  }
  const run = await preflight.getLatestRun(repoId, preflight.getBranch(cwd));
  if (!run) {
    console.log("No Preflight runs recorded yet. Run: companybrain preflight");
    return;
  }
  console.log(`latest run: ${run.status.toUpperCase()} (mode: ${run.mode}) · ${run.summary}`);
  console.log(`safe to commit: ${run.safeToCommit} · safe to push: ${run.safeToPush} · attempt ${run.attempt}/${run.maxAttempts}${run.humanReviewRequired ? " · HUMAN REVIEW REQUIRED" : ""}`);
  console.log(`branch: ${run.branch ?? "—"} · ${new Date(run.createdAt as unknown as string).toLocaleString()}`);
  console.log(`\n${run.agentInstruction}`);
}

async function explainError(cwd: string, errorId: string): Promise<void> {
  const repoId = await resolveRepoId(cwd);
  if (!repoId) {
    console.log("No connected repo — stored errors are only available for connected repos.");
    return;
  }
  const found = await preflight.findErrorByFingerprint(repoId, errorId);
  if (!found) {
    console.log(`No stored error with id "${errorId}". Ids appear in fixInstructions[].id.`);
    return;
  }
  const e = found.error;
  console.log(`error ${errorId} · check: ${e.checkName} · category: ${e.category ?? "unknown"} · priority: ${e.priority ?? "?"}`);
  console.log(`file: ${e.file || "(none)"}${e.line ? `:${e.line}` : ""}`);
  console.log(`problem: ${e.message}`);
  if (e.rawRedacted) console.log(`raw: ${e.rawRedacted}`);
  console.log(`\n${e.instructionForAgent ?? "Fix the problem above, then run preflight again."}`);
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "preflight"); // allow "companybrain preflight ..."
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const cwd = process.env.COMPANY_BRAIN_REPO_PATH || process.cwd();

  if (argv[0] === "init") {
    initConfig(cwd);
    return;
  }
  if (argv.includes("--install-hooks")) {
    installHooks(cwd);
    return;
  }
  if (argv.includes("--uninstall-hooks")) {
    uninstallHooks(cwd);
    return;
  }
  if (argv[0] === "status") {
    await showStatus(cwd);
    await closeDb();
    return;
  }
  if (argv[0] === "explain") {
    const id = argv[1];
    if (!id) {
      console.error("Usage: companybrain preflight explain <errorId>");
      process.exitCode = 1;
      return;
    }
    await explainError(cwd, id);
    await closeDb();
    return;
  }

  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const maxAttempts = flag("--max-attempts") ? Number(flag("--max-attempts")) : undefined;
  const mode = (flag("--mode") ?? (argv.includes("--changed-files") ? "changed-files" : undefined)) as
    | preflight.PreflightMode
    | undefined;

  const repoId = await resolveRepoId(cwd);
  const r = await preflight.runPreflight({
    cwd,
    repoId,
    mode,
    checkOnly: argv.includes("--check-only"),
    maxAttempts,
  });

  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else if (argv.includes("--fix-agent")) printAgent(r);
  else printHuman(r);

  // Close the DB pool and let Node drain the event loop naturally. A hard
  // process.exit() while postgres.js/undici handles are still open aborts on
  // Windows (libuv "UV_HANDLE_CLOSING" assertion) instead of exiting cleanly.
  process.exitCode = r.safeToCommit ? 0 : 1;
  await closeDb();
}

main().catch(async (e) => {
  console.error(`preflight failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
  await closeDb().catch(() => {});
});

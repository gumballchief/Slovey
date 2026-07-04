#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "@company-brain/config";
import { agentPipelineIndex, preflight, resolveRepo } from "@company-brain/core";
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
  companybrain preflight override <decisionId> --reason "<why>" [--hours 168] [--branch <b>]
                                            HUMAN-ONLY: approve a change a decision blocks
                                            (attributed + time-boxed; agents must not run this)
  companybrain preflight --install-hooks    install pre-commit (mode: commit) + pre-push (full) git hooks
  companybrain preflight --uninstall-hooks  remove Company Brain git hooks
  companybrain doctor                       check your setup (git, repo, AI, config, connection)

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
      const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
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
  // Present in agent-pipeline order (Build → Security → Decision → Architecture
  // → Performance → Testing → Context), regardless of execution interleaving.
  const ordered = [...r.checks].sort((a, b) => agentPipelineIndex(a.agent ?? "") - agentPipelineIndex(b.agent ?? ""));
  let lastAgent = "";
  for (const c of ordered) {
    if ((c.agent ?? "") !== lastAgent) {
      lastAgent = c.agent ?? "";
      console.log(`  ── ${lastAgent} agent ──`);
    }
    const s = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–";
    console.log(`  ${s} ${c.name.padEnd(19)} ${c.status.padEnd(8)} ${String(c.durationMs).padStart(6)}ms${c.blocking ? "  [blocking]" : ""}${c.skippedReason ? `  (${c.skippedReason})` : ""}`);
  }
  console.log(`  ── final verdict: ${r.safeToCommit ? "SAFE TO COMMIT" : "DO NOT COMMIT"} ──`);
  if (r.decisionViolations.length) {
    console.log("\nDecision violations:");
    for (const v of r.decisionViolations) console.log(`  ! [${v.decisionStatus}] ${v.title} — ${v.violation}`);
  }
  if (r.fixInstructions.length) {
    console.log("\nFix instructions (highest priority first):");
    for (const f of r.fixInstructions.slice(0, 20)) console.log(`  • [${f.priority}] ${f.file || "(general)"}: ${f.problem}  (id: ${f.id})`);
  }
  for (const w of r.warnings) console.log(`\n⚠ ${w}`);
  // Surface the human's override fast-lane in the human-readable output too.
  const overrideStep = r.nextSteps.find((s) => s.includes("preflight override"));
  if (overrideStep) console.log(`\n→ ${overrideStep}`);
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

/** HUMAN-ONLY: record an attributed, time-boxed override for a blocking decision. */
async function recordOverride(cwd: string, args: string[]): Promise<void> {
  const decisionId = args[0];
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const reason = flag("--reason");
  if (!decisionId || decisionId.startsWith("--") || !reason) {
    console.error('Usage: companybrain preflight override <decisionId> --reason "<why>" [--hours 168] [--branch <b>]');
    process.exitCode = 1;
    return;
  }
  const repoId = await resolveRepoId(cwd);
  if (!repoId) {
    console.error("No connected repo — overrides require a repo connected to Company Brain.");
    process.exitCode = 1;
    return;
  }
  let grantedBy = "";
  try {
    grantedBy = execFileSync("git", ["config", "user.name"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    /* fall through */
  }
  if (!grantedBy) grantedBy = process.env.USERNAME || process.env.USER || "unknown";

  const hours = flag("--hours") ? Number(flag("--hours")) : 168; // default: one week
  const branch = flag("--branch") ?? null;
  const r = await preflight.createOverride({
    repoId,
    decisionIdOrPrefix: decisionId,
    reason,
    grantedBy,
    branch,
    hours: Number.isFinite(hours) ? hours : 168,
  });
  console.log(`override recorded by ${grantedBy}`);
  console.log(`  decision: ${r.decisionId.slice(0, 8)} — ${r.decision.slice(0, 90)}…`);
  console.log(`  reason:   ${reason}`);
  console.log(`  scope:    ${branch ?? "all branches"} · ${r.expiresAt ? `expires ${r.expiresAt.toISOString()}` : "no expiry"}`);
  console.log("\nRe-run preflight — this decision's block is now downgraded to a warning.");
  console.log("For a permanent change, update the decision itself in the dashboard instead.");
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

/**
 * `companybrain doctor` — one command that tells a new user whether their setup
 * is ready, and exactly what to fix if not. Only "not a git repo" is a hard
 * failure; everything else degrades gracefully (that's the design), so the rest
 * are warnings with actionable guidance rather than blockers.
 */
async function doctor(cwd: string): Promise<void> {
  loadEnv(); // ensure .env is applied before we read provider config
  type Line = { level: "pass" | "warn" | "fail"; label: string; detail: string };
  const lines: Line[] = [];

  // 1. Git repository (the one hard requirement).
  const branch = preflight.getBranch(cwd);
  const isGit = existsSync(resolve(cwd, ".git")) || Boolean(branch);
  lines.push(
    isGit
      ? { level: "pass", label: "Git repository", detail: `branch: ${branch ?? "unknown"}` }
      : { level: "fail", label: "Git repository", detail: "no .git found — run this from your repo root" },
  );

  // 2. Repository identity (needed to look up the decision graph).
  let slug = process.env.COMPANY_BRAIN_REPO ?? null;
  let slugSource = "COMPANY_BRAIN_REPO";
  if (!slug && isGit) {
    try {
      slug = parseSlug(execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
      slugSource = "git origin";
    } catch {
      /* no remote */
    }
  }
  lines.push(
    slug
      ? { level: "pass", label: "Repository identity", detail: `${slug} (from ${slugSource})` }
      : { level: "warn", label: "Repository identity", detail: 'set COMPANY_BRAIN_REPO="owner/name" in .env or your .mcp.json env' },
  );

  // API mode (external, self-serve): token set → knowledge checks run on the
  // hosted API, so AI keys and a DB connection aren't the user's concern.
  const api = preflight.apiModeFromEnv();

  // 3. AI provider — only relevant in direct (self-hosted) mode.
  if (api) {
    lines.push({ level: "pass", label: "Mode", detail: `hosted API — ${api.apiUrl}` });
  } else {
    const provider = process.env.AI_PROVIDER || "anthropic";
    const keyVar = provider === "gemini" ? "GEMINI_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    lines.push(
      process.env[keyVar]
        ? { level: "pass", label: "AI provider", detail: `${provider} (key present)` }
        : { level: "warn", label: "AI provider", detail: `${keyVar} not set — decision & security review fall back to deterministic checks` },
    );
  }

  // 4. Preflight config (optional — defaults are sensible).
  const { config, source } = preflight.loadPreflightConfig(cwd);
  lines.push(
    source === "file"
      ? { level: "pass", label: "Preflight config", detail: `companybrain.preflight.json (${config.requiredChecks.length} required, ${config.optionalChecks.length} optional)` }
      : { level: "warn", label: "Preflight config", detail: "using built-in defaults — run 'companybrain preflight init' to customize" },
  );

  // 5. Connection to Company Brain's decision store.
  if (api) {
    lines.push({ level: "pass", label: "Hosted token", detail: "COMPANY_BRAIN_TOKEN set — knowledge checks run on the API" });
  } else if (slug) {
    try {
      const r = await resolveRepo(slug);
      lines.push(
        r
          ? { level: "pass", label: "Connected to Company Brain", detail: `${r.fullName} is connected` }
          : { level: "warn", label: "Connected to Company Brain", detail: `${slug} isn't connected — install the app: https://github.com/apps/company-brain/installations/new` },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lines.push({ level: "warn", label: "Connected to Company Brain", detail: `couldn't reach the decision store (${msg.slice(0, 50)}) — local checks still run` });
    }
  }

  const icon = (l: Line["level"]) => (l === "pass" ? "✓" : l === "fail" ? "✗" : "–");
  console.log("Company Brain — setup check\n");
  for (const l of lines) console.log(`  ${icon(l.level)} ${l.label.padEnd(28)} ${l.detail}`);
  const fails = lines.filter((l) => l.level === "fail").length;
  const warns = lines.filter((l) => l.level === "warn").length;
  console.log("");
  if (fails) {
    console.log(`${fails} blocking issue(s) — fix the ✗ above, then run 'companybrain doctor' again.`);
    process.exitCode = 1;
  } else if (warns) {
    console.log(`Ready to run 'companybrain preflight'. ${warns} optional item(s) marked – would unlock decision checks / customization.`);
  } else {
    console.log("All set — run 'companybrain preflight'.");
  }
  await closeDb();
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "preflight"); // allow "companybrain preflight ..."
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const cwd = process.env.COMPANY_BRAIN_REPO_PATH || process.cwd();

  if (argv[0] === "doctor") {
    await doctor(cwd);
    return;
  }
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
  if (argv[0] === "override") {
    await recordOverride(cwd, argv.slice(1));
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

  const checkOnly = argv.includes("--check-only");
  const apiCfg = preflight.apiModeFromEnv();
  let r: PreflightResult;

  if (apiCfg) {
    // API mode (external, self-serve): run local command + static checks with no
    // DB, then fetch decision-graph / security / architecture checks from the
    // hosted API and merge. Falls back to local-only (with a clear warning) if
    // the hosted service is unreachable — never blocks the developer on our uptime.
    const local = await preflight.runPreflight({ cwd, repoId: null, mode, checkOnly, maxAttempts });
    const wantsKnowledge = !checkOnly && mode !== "quick" && mode !== "planning";
    if (wantsKnowledge) {
      try {
        const remote = await preflight.fetchRemoteKnowledge(apiCfg, preflight.collectChangePayload(cwd));
        r = preflight.mergeRemote(local, remote);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Fail OPEN on transient hosted downtime — our uptime must not block a
        // developer's commit. Downgrade the now-unverifiable decision-check from a
        // blocking skip to non-blocking, keep a loud warning, and recompute the
        // verdict from the checks we could actually run. The GitHub App re-checks
        // the decision graph server-side at PR time as the backstop.
        const checks = local.checks.map((c) =>
          c.name === "decision-check" && c.status === "skipped" ? { ...c, blocking: false } : c,
        );
        const blocked = checks.some((c) => c.blocking && c.status === "fail");
        const anyFail = checks.some((c) => c.status === "fail");
        r = {
          ...local,
          checks,
          safeToCommit: !blocked,
          safeToPush: !blocked,
          status: blocked ? "fail" : anyFail ? "partial" : "pass",
          warnings: [...local.warnings, `Company Brain hosted checks unavailable (${msg.slice(0, 90)}) — ran local checks only; the decision graph was NOT verified (it will be re-checked on your PR).`],
        };
      }
    } else {
      r = local;
    }
  } else {
    const repoId = await resolveRepoId(cwd);
    r = await preflight.runPreflight({ cwd, repoId, mode, checkOnly, maxAttempts });
  }

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

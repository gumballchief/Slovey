import { readChanged } from "./checks";
import { getBranch, getChangedFiles, getCommitSha, getDiff } from "./detect";
import { resolveStatus } from "./engine";
import type { CheckResult, PreflightResult } from "./types";

/** Default hosted API. Override with SLOVEY_API_URL (or legacy COMPANY_BRAIN_API_URL). */
const DEFAULT_API_URL = "https://slovey.dev";

export interface ChangePayload {
  diff: string;
  changedFiles: string[];
  files: { path: string; content: string }[];
  branch: string | null;
  commitSha: string | null;
}

/** Collect the diff + changed-file contents to send to the hosted knowledge API. */
export function collectChangePayload(cwd: string, changedOverride?: string[]): ChangePayload {
  const changedFiles = changedOverride?.length ? changedOverride : getChangedFiles(cwd);
  return {
    diff: getDiff(cwd, changedFiles),
    changedFiles,
    files: readChanged(cwd, changedFiles),
    branch: getBranch(cwd),
    commitSha: getCommitSha(cwd),
  };
}

export interface ApiModeConfig {
  apiUrl: string;
  token: string;
}

/**
 * API-mode config from env: present only when SLOVEY_TOKEN (or the legacy
 * COMPANY_BRAIN_TOKEN) is set. This is how an external user (no DB, no AI keys)
 * runs the gate — local checks locally, knowledge checks against the hosted API.
 *
 * SLOVEY_* wins when both are set; COMPANY_BRAIN_* stays accepted so existing
 * setups and CI configs keep working after the rebrand.
 */
export function apiModeFromEnv(): ApiModeConfig | null {
  const token = process.env.SLOVEY_TOKEN?.trim() || process.env.COMPANY_BRAIN_TOKEN?.trim();
  if (!token) return null;
  const url = process.env.SLOVEY_API_URL?.trim() || process.env.COMPANY_BRAIN_API_URL?.trim();
  const apiUrl = (url || DEFAULT_API_URL).replace(/\/+$/, "");
  return { apiUrl, token };
}

/** The hosted API answered with an error status (vs. being unreachable). */
export class RemotePreflightHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RemotePreflightHttpError";
  }
}

/** Fetch the hosted knowledge checks. Throws on network/auth error (caller degrades). */
export async function fetchRemoteKnowledge(
  cfg: ApiModeConfig,
  payload: ChangePayload,
  timeoutMs = 120_000,
): Promise<PreflightResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.apiUrl}/api/cli/preflight`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RemotePreflightHttpError(
        res.status,
        `hosted preflight HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
      );
    }
    const json = (await res.json()) as { result: PreflightResult };
    if (!json?.result) throw new Error("hosted preflight returned no result");
    return json.result;
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error(`hosted preflight timed out after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The verdict when the hosted checks could not be used, built from the local
 * result alone. Pure + unit-tested.
 *
 * Downtime (unreachable, timeout, 5xx, rate limit) fails OPEN: our uptime must
 * not block a developer's commit. The unverifiable decision-check stops
 * blocking, a loud warning says so, and the GitHub App re-checks the decision
 * graph at PR time as the backstop.
 *
 * A rejected token (401/403) fails CLOSED: waiting never fixes it, and failing
 * open would quietly switch the decision gate off for good (a revoked token, a
 * typo in CI) with only a warning line to show for it.
 */
export function localOnlyResult(local: PreflightResult, err: unknown): PreflightResult {
  const msg = err instanceof Error ? err.message : String(err);
  const rejected = err instanceof RemotePreflightHttpError && (err.status === 401 || err.status === 403);

  if (rejected) {
    const reason = `Slovey rejected your token (HTTP ${(err as RemotePreflightHttpError).status}), so the decision graph could not be checked.`;
    const checks: CheckResult[] = local.checks.map((c) =>
      c.name === "decision-check"
        ? { ...c, status: "error", blocking: true, skippedReason: reason }
        : c,
    );
    if (!checks.some((c) => c.name === "decision-check")) {
      checks.push({ name: "decision-check", status: "error", command: "", durationMs: 0, blocking: true, errors: [], skippedReason: reason });
    }
    const anyFailure = checks.some((c) => c.status === "fail");
    return {
      ...local,
      checks,
      safeToCommit: false,
      safeToPush: false,
      status: resolveStatus({ checks, blocked: true, anyFailure, blockingViolations: 0 }),
      warnings: [
        ...local.warnings,
        `${reason} Commit blocked until it is fixed: create a new token in the Slovey dashboard and set SLOVEY_TOKEN.`,
      ],
      agentInstruction:
        "Agent, do not commit. The SLOVEY_TOKEN is invalid, expired or revoked, so Slovey's decision checks could not run. A human has to create a new token in the Slovey dashboard; do not try to work around this.",
    };
  }

  const checks = local.checks.map((c) =>
    c.name === "decision-check" && c.status === "skipped" ? { ...c, blocking: false } : c,
  );
  const blocked = checks.some((c) => c.blocking && c.status === "fail");
  const anyFailure = checks.some((c) => c.status === "fail");
  return {
    ...local,
    checks,
    safeToCommit: !blocked,
    safeToPush: !blocked,
    status: resolveStatus({ checks, blocked, anyFailure, blockingViolations: 0 }),
    warnings: [
      ...local.warnings,
      `Slovey hosted checks unavailable (${msg.slice(0, 90)}) — ran local checks only; the decision graph was NOT verified (it will be re-checked on your PR).`,
    ],
  };
}

/** Checks the hosted API owns (they need the decision graph / server AI keys). */
const KNOWLEDGE_CHECKS = new Set(["decision-check", "security-review"]);

/**
 * Merge a local result (real command + static checks; knowledge checks skipped
 * for lack of a DB) with the hosted knowledge result into one verdict. Pure +
 * unit-tested. Local owns command/static/config-architecture; remote contributes
 * decision-check, security-review, and architecture rules derived from rejected
 * decisions (folded into the local architecture-check).
 */
export interface MergeGate {
  allowSkippedChecks: boolean;
  blockCommitOnFailure: boolean;
  blockPushOnFailure: boolean;
}

export function mergeRemote(
  local: PreflightResult,
  remote: PreflightResult,
  gate: MergeGate = { allowSkippedChecks: false, blockCommitOnFailure: true, blockPushOnFailure: true },
): PreflightResult {
  const remoteByName = (n: string) => remote.checks.find((c) => c.name === n);

  // Base = local checks minus the knowledge ones (they were skipped locally).
  const checks: CheckResult[] = local.checks.filter((c) => !KNOWLEDGE_CHECKS.has(c.name));
  for (const name of KNOWLEDGE_CHECKS) {
    const rc = remoteByName(name);
    if (rc) checks.push({ ...rc });
  }

  // Fold remote's derived architecture-rule hits into the local architecture-check.
  // Clone rather than mutate — `local` is the caller's object and must be left intact.
  const remoteArch = remoteByName("architecture-check");
  if (remoteArch && remoteArch.status !== "pass") {
    const idx = checks.findIndex((c) => c.name === "architecture-check");
    if (idx >= 0) {
      const localArch = checks[idx]!;
      const seen = new Set(localArch.errors.map((e) => `${e.file}:${e.message}`));
      const extra = remoteArch.errors.filter((e) => !seen.has(`${e.file}:${e.message}`));
      const errors = [...localArch.errors, ...extra];
      const mergedStatus = errors.length ? "fail" : localArch.status !== "pass" ? localArch.status : remoteArch.status;
      checks[idx] = { ...localArch, errors, status: mergedStatus };
    } else {
      checks.push({ ...remoteArch });
    }
  }

  const decisionViolations = remote.decisionViolations ?? [];
  const warnings = [...local.warnings, ...remote.warnings];

  const fixSeen = new Set<string>();
  const fixInstructions = [...local.fixInstructions, ...remote.fixInstructions].filter((f) =>
    fixSeen.has(f.id) ? false : (fixSeen.add(f.id), true),
  );

  // Same gate as the local engine: a blocking check that errored, or was skipped
  // without allowSkippedChecks, cannot count as a pass. Remote fail/unverified
  // verdicts arrive as the merged knowledge checks above, judged under the
  // repo's own gate settings.
  const blocked =
    checks.some(
      (c) =>
        c.blocking &&
        (c.status === "fail" || c.status === "error" || (c.status === "skipped" && !gate.allowSkippedChecks)),
    ) || decisionViolations.length > 0;
  // A hosted run that errored is treated like hosted downtime: fail open (our
  // uptime must not block a commit) but never silently. The GitHub App
  // re-checks the decision graph at PR time.
  if (remote.status === "error") {
    warnings.push(
      "Slovey hosted checks errored. The decision graph was NOT verified for this change (it will be re-checked on your PR).",
    );
  }
  const anyFailure = checks.some((c) => c.status === "fail") || decisionViolations.length > 0;
  // Same resolver as the local engine so the two can't drift.
  const status = resolveStatus({ checks, blocked, anyFailure, blockingViolations: decisionViolations.length });
  const hasViolations = decisionViolations.length > 0;

  return {
    ...local,
    status,
    safeToCommit: !blocked ? true : !gate.blockCommitOnFailure && !hasViolations,
    safeToPush: !blocked ? true : !gate.blockPushOnFailure && !hasViolations,
    checks,
    decisionViolations,
    warnings,
    fixInstructions,
    summary: "local checks + hosted decision-graph / security / architecture checks.",
    agentInstruction: blocked
      ? "Agent, do not commit. Fix the reported failures — including any Company Brain decision-graph violations — then run preflight again."
      : local.agentInstruction,
  };
}

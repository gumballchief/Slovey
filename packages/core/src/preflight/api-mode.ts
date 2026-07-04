import { readChanged } from "./checks";
import { getBranch, getChangedFiles, getCommitSha, getDiff } from "./detect";
import type { CheckResult, PreflightResult } from "./types";

/** Default hosted API (the live Render service). Override with COMPANY_BRAIN_API_URL. */
const DEFAULT_API_URL = "https://company-brain-web-u04w.onrender.com";

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
 * API-mode config from env: present only when COMPANY_BRAIN_TOKEN is set. This is
 * how an external user (no DB, no AI keys) runs the gate — local checks locally,
 * knowledge checks against the hosted API.
 */
export function apiModeFromEnv(): ApiModeConfig | null {
  const token = process.env.COMPANY_BRAIN_TOKEN?.trim();
  if (!token) return null;
  const apiUrl = (process.env.COMPANY_BRAIN_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
  return { apiUrl, token };
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
      throw new Error(`hosted preflight HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
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

/** Checks the hosted API owns (they need the decision graph / server AI keys). */
const KNOWLEDGE_CHECKS = new Set(["decision-check", "security-review"]);

/**
 * Merge a local result (real command + static checks; knowledge checks skipped
 * for lack of a DB) with the hosted knowledge result into one verdict. Pure +
 * unit-tested. Local owns command/static/config-architecture; remote contributes
 * decision-check, security-review, and architecture rules derived from rejected
 * decisions (folded into the local architecture-check).
 */
export function mergeRemote(local: PreflightResult, remote: PreflightResult): PreflightResult {
  const remoteByName = (n: string) => remote.checks.find((c) => c.name === n);

  // Base = local checks minus the knowledge ones (they were skipped locally).
  const checks: CheckResult[] = local.checks.filter((c) => !KNOWLEDGE_CHECKS.has(c.name));
  for (const name of KNOWLEDGE_CHECKS) {
    const rc = remoteByName(name);
    if (rc) checks.push({ ...rc });
  }

  // Fold remote's derived architecture-rule hits into the local architecture-check.
  const localArch = checks.find((c) => c.name === "architecture-check");
  const remoteArch = remoteByName("architecture-check");
  if (remoteArch?.errors.length) {
    if (localArch) {
      const seen = new Set(localArch.errors.map((e) => `${e.file}:${e.message}`));
      for (const e of remoteArch.errors) {
        const k = `${e.file}:${e.message}`;
        if (!seen.has(k)) {
          localArch.errors.push(e);
          seen.add(k);
        }
      }
      localArch.status = localArch.errors.length ? "fail" : localArch.status;
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

  const blocked = checks.some((c) => c.blocking && c.status === "fail") || decisionViolations.length > 0;
  const anyFailure = checks.some((c) => c.status === "fail") || decisionViolations.length > 0;
  const status: PreflightResult["status"] = blocked ? "fail" : anyFailure ? "partial" : "pass";

  return {
    ...local,
    status,
    safeToCommit: !blocked,
    safeToPush: !blocked,
    checks,
    decisionViolations,
    warnings,
    fixInstructions,
    summary: `${status.toUpperCase()} — local checks + hosted decision-graph / security / architecture checks.`,
    agentInstruction: blocked
      ? "Agent, do not commit. Fix the reported failures — including any Company Brain decision-graph violations — then run preflight again."
      : local.agentInstruction,
  };
}

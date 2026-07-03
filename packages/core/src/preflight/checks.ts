import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parseErrors } from "./parse";
import { scanForSecrets } from "./redact";
import { runCommand } from "./runner";
import type { CheckResult, PreflightError } from "./types";

/** Check helpers return everything but `blocking` — the engine stamps that from requiredChecks. */
export type RawCheck = Omit<CheckResult, "blocking">;

const tail = (s: string, n = 800) => (s.length > n ? `…${s.slice(-n)}` : s) || undefined;

/** Run a command-backed check (typecheck/lint/test/build/format). */
export async function runCommandCheck(
  name: string,
  command: string,
  cwd: string,
  timeoutMs: number,
  allowlist: string[] = [],
): Promise<RawCheck> {
  const r = await runCommand(cwd, command, timeoutMs, allowlist);
  const summaries = { stdoutSummary: tail(r.stdout), stderrSummary: tail(r.stderr) };
  if (r.refusedReason) {
    return { name, status: "skipped", command, durationMs: r.durationMs, errors: [], skippedReason: r.refusedReason };
  }
  if (r.timedOut) {
    return {
      name, status: "fail", command, durationMs: r.durationMs, ...summaries,
      errors: [{ file: "", code: "timeout", category: "timeout", message: `${name} exceeded the ${timeoutMs}ms timeout and was killed.` }],
    };
  }
  if (r.ok) return { name, status: "pass", command, durationMs: r.durationMs, errors: [], ...summaries };
  const combined = `${r.stdout}\n${r.stderr}`;
  // A configured command that points at a non-existent script → skip, don't fail.
  if (/missing script|no script named|command ".+" not found|ERR_PNPM_NO_SCRIPT|npm error missing script/i.test(combined)) {
    return { name, status: "skipped", command, durationMs: r.durationMs, errors: [], skippedReason: `No "${name}" script exists for command "${command}"; skipping.` };
  }
  return { name, status: "fail", command, durationMs: r.durationMs, errors: parseErrors(name, combined), ...summaries };
}

/** Read changed files' text content (skips missing, binary-ish, or oversized). */
export function readChanged(cwd: string, files: string[], maxBytes = 512_000): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const rel of files) {
    const abs = resolve(cwd, rel);
    try {
      if (!existsSync(abs) || statSync(abs).size > maxBytes) continue;
      const content = readFileSync(abs, "utf8");
      if (content.includes("\u0000")) continue; // NUL byte -> binary file
      out.push({ path: rel, content });
    } catch {
      /* unreadable → skip */
    }
  }
  return out;
}

/** security/basic secret scan over changed source files. */
export function secretScanCheck(cwd: string, changed: string[]): RawCheck {
  const start = Date.now();
  const errors = scanForSecrets(readChanged(cwd, changed));
  return {
    name: "secret-scan", command: "", durationMs: Date.now() - start,
    status: errors.length ? "fail" : "pass", errors,
  };
}

/** Provided by the OS/runtime/CI, not by app configuration — never belongs in
 *  .env.example (found by dogfooding: flagged process.env.USERNAME). */
const OS_PROVIDED_VARS = new Set([
  "USER", "USERNAME", "HOME", "USERPROFILE", "PATH", "TEMP", "TMP", "TMPDIR",
  "SHELL", "HOSTNAME", "PWD", "LANG", "TZ", "CI", "PORT", "NODE_ENV",
]);

/** env var check: process.env.X referenced in changed code but absent from .env.example. */
export function envCheck(cwd: string, changed: string[]): RawCheck {
  const start = Date.now();
  const declared = new Set<string>();
  for (const f of [".env.example", ".env.sample", ".env.template"]) {
    try {
      for (const line of readFileSync(resolve(cwd, f), "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*=/);
        if (m) declared.add(m[1]!);
      }
    } catch {
      /* file may not exist */
    }
  }
  const errors: PreflightError[] = [];
  const ref = /process\.env\.([A-Z][A-Z0-9_]+)/g;
  for (const { path, content } of readChanged(cwd, changed)) {
    const seen = new Set<string>();
    for (const m of content.matchAll(ref)) {
      const key = m[1]!;
      if (key.startsWith("NEXT_PUBLIC_") || OS_PROVIDED_VARS.has(key) || declared.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (declared.size > 0) {
        errors.push({ file: path, code: "env", category: "env", message: `Uses process.env.${key} but it is not documented in .env.example.` });
      }
    }
  }
  return { name: "env-check", command: "", durationMs: Date.now() - start, status: errors.length ? "fail" : "pass", errors };
}

/** route/page check: changed Next.js route handlers must export a valid HTTP method. */
export function routeCheck(cwd: string, changed: string[]): RawCheck {
  const start = Date.now();
  const errors: PreflightError[] = [];
  const routeFiles = changed.filter((f) => /(^|\/)route\.(t|j)sx?$/.test(f) && f.includes("/api/"));
  const METHOD = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)|export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/;
  for (const { path, content } of readChanged(cwd, routeFiles)) {
    if (!METHOD.test(content)) {
      errors.push({ file: path, code: "route", category: "route", message: "Route file exports no HTTP method handler (GET/POST/…). It will 404." });
    }
  }
  return { name: "route-check", command: "", durationMs: Date.now() - start, status: errors.length ? "fail" : "pass", errors };
}

/** dependency check: a lockfile exists and package.json parses. */
export function depsCheck(cwd: string): RawCheck {
  const start = Date.now();
  const errors: PreflightError[] = [];
  const hasLock = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"].some((f) => existsSync(resolve(cwd, f)));
  if (!hasLock) errors.push({ file: "", code: "deps", category: "deps", message: "No lockfile found — dependency versions are unpinned." });
  try {
    JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  } catch {
    errors.push({ file: "package.json", code: "deps", category: "deps", message: "package.json is missing or not valid JSON." });
  }
  return { name: "deps", command: "", durationMs: Date.now() - start, status: errors.length ? "fail" : "pass", errors };
}

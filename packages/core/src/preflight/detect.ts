import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

export interface ProjectInfo {
  type: "node" | "unknown";
  packageManager: PackageManager;
  scripts: Record<string, string>;
  isNext: boolean;
  hasTsconfig: boolean;
}

export function detectProject(cwd: string): ProjectInfo {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return { type: "unknown", packageManager: "npm", scripts: {}, isNext: false, hasTsconfig: false };
  }
  let pkg: {
    scripts?: Record<string, string>;
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    /* malformed package.json → treat as no scripts */
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return {
    type: "node",
    packageManager: detectPackageManager(cwd, pkg.packageManager),
    scripts: pkg.scripts ?? {},
    isNext: "next" in deps,
    hasTsconfig: existsSync(resolve(cwd, "tsconfig.json")),
  };
}

export function detectPackageManager(cwd: string, declared?: string): PackageManager {
  if (declared?.startsWith("pnpm")) return "pnpm";
  if (declared?.startsWith("yarn")) return "yarn";
  if (declared?.startsWith("bun")) return "bun";
  if (declared?.startsWith("npm")) return "npm";
  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

/** The command to invoke a package.json script, e.g. "pnpm run typecheck". */
export function scriptCommand(pm: PackageManager, script: string): string {
  return pm === "npm" ? `npm run ${script}` : `${pm} run ${script}`;
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function getBranch(cwd: string): string | null {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || null;
}

export function getCommitSha(cwd: string): string | null {
  return git(cwd, ["rev-parse", "HEAD"]) || null;
}

/**
 * Files changed vs HEAD: staged + unstaged + untracked (deduped). This is the
 * set a pre-commit gate cares about. Empty when not a git repo.
 */
export function getChangedFiles(cwd: string): string[] {
  const out = new Set<string>();
  for (const spec of [["diff", "--name-only", "HEAD"], ["diff", "--cached", "--name-only"], ["ls-files", "--others", "--exclude-standard"]]) {
    for (const f of git(cwd, spec).split("\n")) if (f.trim()) out.add(f.trim());
  }
  return [...out];
}

/** Unified diff for a set of files, capped, for feeding the decision check.
 *  Untracked files never appear in `git diff` — and brand-new files are exactly
 *  what coding agents create — so their contents are appended as a pseudo-diff. */
export function getDiff(cwd: string, files: string[], maxChars = 12_000): string {
  let d = git(cwd, ["diff", "HEAD", "--", ...files]) || git(cwd, ["diff", "--cached", "--", ...files]);
  const inDiff = new Set([...d.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]!));
  for (const f of files) {
    if (inDiff.has(f) || d.length >= maxChars) continue;
    const abs = resolve(cwd, f);
    try {
      if (!existsSync(abs) || statSync(abs).size > 100_000) continue;
      const content = readFileSync(abs, "utf8");
      if (content.includes("\u0000")) continue; // binary
      d += `\n+++ b/${f} (new file)\n${content.split("\n").map((l) => `+${l}`).join("\n")}`;
    } catch {
      /* unreadable → skip */
    }
  }
  return d.length > maxChars ? `${d.slice(0, maxChars)}\n…(diff truncated)` : d;
}

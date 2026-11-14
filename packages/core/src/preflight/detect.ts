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
  if (existsSync(resolve(cwd, "bun.lockb")) || existsSync(resolve(cwd, "bun.lock"))) return "bun";
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

/** Split NUL-terminated git output, preserving names verbatim (no trim/quoting). */
export function parseNulSeparatedPaths(output: string): string[] {
  return output.split("\0").filter((f) => f.length > 0);
}

function gitZ(cwd: string, args: string[]): string[] {
  try {
    return parseNulSeparatedPaths(execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return [];
  }
}

export function getBranch(cwd: string): string | null {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || null;
}

/** Absolute path of the git worktree root, or null outside a repo. */
export function getRepoRoot(cwd: string): string | null {
  return git(cwd, ["rev-parse", "--show-toplevel"]) || null;
}

export function getCommitSha(cwd: string): string | null {
  return git(cwd, ["rev-parse", "HEAD"]) || null;
}

/**
 * Vendored/generated dirs are never the user's change. `--exclude-standard`
 * only honors .gitignore — a fresh repo without one reports all of
 * node_modules as untracked, and secret-scan then flags example keys inside
 * dependency READMEs as critical findings. Excluded unconditionally.
 */
const VENDORED_PATH =
  /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|\.nuxt|\.turbo|\.cache|vendor|\.venv|__pycache__)(\/|$)/;

/**
 * Files changed vs HEAD: staged + unstaged + untracked (deduped). This is the
 * set a pre-commit gate cares about. Empty when not a git repo.
 */
export function getChangedFiles(cwd: string): string[] {
  const out = new Set<string>();
  for (const spec of [["diff", "--name-only", "-z", "HEAD"], ["diff", "--cached", "--name-only", "-z"], ["ls-files", "--others", "--exclude-standard", "-z"]]) {
    for (const f of gitZ(cwd, ["-c", "core.quotePath=false", ...spec])) out.add(f);
  }
  return [...out].filter((f) => !VENDORED_PATH.test(f));
}

/** Files named by genuine `+++ b/<file>` headers in a unified diff. A header
 *  is only genuine before the first hunk (`@@`) of a file entry and when it
 *  immediately follows a `--- ` line; a `+++ b/...` line inside a hunk is
 *  file content an author can forge to hide an untracked file. */
export function filesInDiff(d: string): Set<string> {
  const out = new Set<string>();
  const lines = d.split("\n");
  let inHunk = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@ ")) {
      inHunk = true;
      continue;
    }
    if (!inHunk && line.startsWith("+++ b/") && i > 0 && lines[i - 1]!.startsWith("--- ")) {
      out.add(line.slice("+++ b/".length));
    }
  }
  return out;
}

/** Unified diff for a set of files, capped, for feeding the decision check.
 *  Untracked files never appear in `git diff` — and brand-new files are exactly
 *  what coding agents create — so their contents are appended as a pseudo-diff. */
export function getDiff(cwd: string, files: string[], maxChars = 12_000): string {
  let d = git(cwd, ["-c", "core.quotePath=false", "diff", "HEAD", "--", ...files]) || git(cwd, ["-c", "core.quotePath=false", "diff", "--cached", "--", ...files]);
  const inDiff = filesInDiff(d);
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

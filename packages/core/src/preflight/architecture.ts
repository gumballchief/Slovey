import { readChanged, type RawCheck } from "./checks";
import type { ArchitectureRule, PreflightError } from "./types";

/**
 * Rule-based architecture check. Deliberately not an LLM: rules are explicit,
 * fast, and deterministic — the decision-graph check handles the fuzzy cases.
 * Rules run against the CHANGED files only, so a legacy violation elsewhere in
 * the repo doesn't block an unrelated commit.
 */
export function architectureCheck(cwd: string, changed: string[], rules: ArchitectureRule[]): RawCheck {
  const start = Date.now();
  const errors: PreflightError[] = [];
  if (rules.length === 0) {
    return {
      name: "architecture-check", command: "", durationMs: Date.now() - start,
      status: "skipped", errors, skippedReason: "No architecture rules configured (architectureChecks.rules).",
    };
  }

  const pathRules = rules.filter((r) => r.type === "forbidden-path");
  const contentRules = rules.filter((r) => r.type !== "forbidden-path");

  for (const rule of pathRules) {
    const re = globToRegex(rule.glob);
    for (const f of changed) {
      if (re.test(f)) {
        errors.push({
          file: f, code: "arch-path", category: "architecture",
          message: `Changes to this path are forbidden: ${rule.reason}`,
        });
      }
    }
  }

  if (contentRules.length > 0) {
    for (const { path, content } of readChanged(cwd, changed)) {
      const lines = content.split("\n");
      for (const rule of contentRules) {
        if (rule.in && !globToRegex(rule.in).test(path)) continue;
        const re =
          rule.type === "forbidden-import"
            ? importRegex(rule.module)
            : safePattern(rule.pattern);
        if (!re) continue;
        for (let i = 0; i < lines.length; i++) {
          re.lastIndex = 0;
          if (re.test(lines[i]!)) {
            errors.push({
              file: path, line: i + 1, category: "architecture",
              code: rule.type === "forbidden-import" ? "arch-import" : "arch-content",
              message:
                rule.type === "forbidden-import"
                  ? `Forbidden import "${rule.module}": ${rule.reason}`
                  : `Forbidden pattern: ${rule.reason}`,
              raw: lines[i]!.trim().slice(0, 200),
            });
          }
        }
      }
    }
  }

  return { name: "architecture-check", command: "", durationMs: Date.now() - start, status: errors.length ? "fail" : "pass", errors };
}

/** Matches ESM imports, dynamic import(), and require() of a module (or subpath). */
function importRegex(module: string): RegExp {
  const m = escapeRegex(module);
  return new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"]${m}(?:/[^'"]*)?['"]`);
}

/** User-supplied regex; a bad pattern disables the rule instead of crashing the gate. */
function safePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/** Minimal glob → regex: ** crosses directories (including zero, so "**\/x.ts"
 *  matches a top-level "x.ts"), * stays within one segment. */
export function globToRegex(glob: string): RegExp {
  const re = escapeRegex(glob)
    .replace(/\\\*\\\*\//g, "(?:.*/)?")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${re}$`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

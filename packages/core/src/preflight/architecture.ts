import { readChanged, type RawCheck } from "./checks";
import { distinctiveTerms } from "./decisions";
import type { ArchitectureRule, PreflightError } from "./types";

/**
 * Rule-based architecture check. Deliberately not an LLM: rules are explicit,
 * fast, and deterministic — the decision-graph check handles the fuzzy cases.
 * Rules run against the CHANGED files only, so a legacy violation elsewhere in
 * the repo doesn't block an unrelated commit.
 */
export function architectureCheck(cwd: string, changed: string[], rules: ArchitectureRule[]): RawCheck {
  return architectureCheckContents(readChanged(cwd, changed), changed, rules);
}

/** Same check against in-memory file contents — used by the server-side API,
 *  which has no local working tree to read from. */
export function architectureCheckContents(
  files: { path: string; content: string }[],
  changedPaths: string[],
  rules: ArchitectureRule[],
): RawCheck {
  const start = Date.now();
  const errors: PreflightError[] = [];
  if (rules.length === 0) {
    // Vacuously true — with no rules there is nothing to violate. This must NOT
    // be "skipped": a skipped required check fails the gate, and an empty rule
    // set is a valid state (unlike a missing typecheck script, no coverage is
    // lost). Found by dogfooding: the empty-rule state blocked every commit.
    return {
      name: "architecture-check", command: "", durationMs: Date.now() - start,
      status: "pass", errors,
      skippedReason: "No architecture rules configured or derivable from rejected decisions — nothing to enforce.",
    };
  }

  const pathRules = rules.filter((r) => r.type === "forbidden-path");
  const contentRules = rules.filter((r) => r.type !== "forbidden-path");

  for (const rule of pathRules) {
    const re = globToRegex(rule.glob);
    for (const f of changedPaths) {
      if (re.test(f)) {
        errors.push({
          file: f, code: "arch-path", category: "architecture",
          message: `Changes to this path are forbidden: ${rule.reason}`,
        });
      }
    }
  }

  if (contentRules.length > 0) {
    for (const { path, content } of files) {
      // Content rules without an explicit `in` scope apply to CODE files only —
      // keyword rules matching prose (notes, tweets.json, docs) is pure noise.
      // An explicit `in` glob overrides this and scopes exactly as written.
      const lines = content.split("\n");
      for (const rule of contentRules) {
        if (rule.in && !globToRegex(rule.in).test(path)) continue;
        if (!rule.in && !CODE_FILE.test(path)) continue;
        const re =
          rule.type === "forbidden-import"
            ? importRegex(rule.module)
            : safePattern(rule.pattern, rule.flags);
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

/**
 * Derive deterministic forbidden-pattern rules from REJECTED decisions: a
 * whole-word reappearance of a rejected decision's distinctive term in changed
 * code is flagged without any LLM. Complements the (AI) decision-check, and
 * keeps the rejected-pattern guard alive when the AI provider is down.
 */
export function rulesFromRejectedDecisions(
  rejected: { id: string; decision: string }[],
): ArchitectureRule[] {
  const rules: ArchitectureRule[] = [];
  for (const d of rejected) {
    for (const term of distinctiveTerms(d.decision, 2)) {
      rules.push({
        type: "forbidden-content",
        pattern: `\\b${term.replace(/[.*+?^${}()|[\]\\/@-]/g, "\\$&")}\\b`,
        flags: "i",
        reason: `Rejected by team decision: "${d.decision.slice(0, 110)}"`,
      });
    }
  }
  return rules;
}

/** Files whose contents are executable code (unscoped content rules apply here only). */
const CODE_FILE = /\.(c|m)?(t|j)sx?$|\.(py|rb|go|rs|java|kt|swift|cs|php|sql|sh|vue|svelte)$/i;

/** Matches ESM imports, dynamic import(), and require() of a module (or subpath). */
function importRegex(module: string): RegExp {
  const m = escapeRegex(module);
  return new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"]${m}(?:/[^'"]*)?['"]`);
}

/** User-supplied regex; a bad pattern or flags disables the rule instead of crashing the gate. */
function safePattern(pattern: string, flags?: string): RegExp | null {
  try {
    return new RegExp(pattern, flags);
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

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
      // Cap per-line length so even a merely-expensive (non-evil) pattern
      // cannot backtrack over an unbounded attacker-controlled line.
      const scanned = lines.map((l) => l.slice(0, 10_000)).join("\n");
      // Precomputed line-start offsets: binary-search m.index instead of
      // slicing + splitting per match (which is O(matches x fileSize)).
      const lineStarts: number[] = [0];
      for (let i = 0; i < scanned.length; i++) {
        if (scanned[i] === "\n") lineStarts.push(i + 1);
      }
      for (const rule of contentRules) {
        if (rule.in && !globToRegex(rule.in).test(path)) continue;
        if (!rule.in && !CODE_FILE.test(path)) continue;
        const re =
          rule.type === "forbidden-import"
            ? importRegex(rule.module)
            : safePattern(rule.pattern, rule.flags);
        if (!re) continue;
        const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
        const greedy = new RegExp(re.source, flags);
        let seen = 0;
        for (const m of scanned.matchAll(greedy)) {
          if (seen >= MAX_CONTENT_MATCHES_PER_RULE_FILE) break;
          seen++;
          if (!m[0]) continue;
          const line = lineNumberAt(lineStarts, m.index ?? 0);
          errors.push({
            file: path, line, category: "architecture",
            code: rule.type === "forbidden-import" ? "arch-import" : "arch-content",
            message:
              rule.type === "forbidden-import"
                ? `Forbidden import "${rule.module}": ${rule.reason}`
                : `Forbidden pattern: ${rule.reason}`,
            raw: lines[line - 1]!.trim().slice(0, 200),
          });
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

/** Matches ESM imports (incl. side-effect), re-exports, dynamic import(), and require() of a module (or subpath). */
function importRegex(module: string): RegExp {
  const m = escapeRegex(module);
  return new RegExp(
    `(?:from\\s*|import\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"]${m}(?:/[^'"]*)?['"]` +
      `|(?:from\\s+[^\\n'"]*\\b${m}\\b|import\\s+[^\\n'"]*\\b${m}\\b)` +
      `|require(?:_relative)?\\s*\\(?\\s*['"]${m}(?:/[^'"]*)?['"]`,
  );
}

/** User-supplied regex; a bad pattern or flags disables the rule instead of crashing the gate. */
function safePattern(pattern: string, flags?: string): RegExp | null {
  if (!pattern || pattern.length > 512 || hasEvilQuantifier(pattern)) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Detect catastrophic-backtracking shapes: a quantified group whose body
 * itself contains a quantifier ("(x+x+)+", "(.*)*") or an alternation
 * ("(a|aa)+") — the classic nested-quantifier ReDoS. Quantified groups
 * over a plain body ("(foo)+") and unquantified groups ("(a|b)") stay legal.
 */
function hasEvilQuantifier(pattern: string): boolean {
  const stack: { innerQuantifier: boolean; alternation: boolean }[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "\\") { i++; continue; }
    if (inClass) { if (ch === "]") inClass = false; continue; }
    if (ch === "[") { inClass = true; continue; }
    if (ch === "(") { stack.push({ innerQuantifier: false, alternation: false }); continue; }
    if (ch === "|") { if (stack.length) stack[stack.length - 1]!.alternation = true; continue; }
    if (ch === ")") {
      const frame = stack.pop();
      const next = pattern[i + 1];
      const quantified = next === "+" || next === "*" || (next === "{" && /^\{\d+(,\d*)?\}/.test(pattern.slice(i + 1)));
      if (frame && stack.length) {
        const parent = stack[stack.length - 1]!;
        parent.innerQuantifier ||= frame.innerQuantifier || quantified;
        parent.alternation ||= frame.alternation;
      }
      if (frame && quantified && (frame.innerQuantifier || frame.alternation)) return true;
      continue;
    }
    if (ch === "+" || ch === "*") { if (stack.length) stack[stack.length - 1]!.innerQuantifier = true; continue; }
    if (ch === "{" && /^\{\d+(,\d*)?\}/.test(pattern.slice(i))) {
      if (stack.length) stack[stack.length - 1]!.innerQuantifier = true;
    }
  }
  return false;
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

/** Max reported matches per content rule per file — bounds per-request CPU and errors. */
const MAX_CONTENT_MATCHES_PER_RULE_FILE = 100;

/** 1-based line number for an offset via binary search over line-start offsets. */
function lineNumberAt(lineStarts: number[], index: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

import type { ErrorCategory, FixInstruction, Priority, PreflightError } from "./types";

/** tsc: "src/x.ts(12,5): error TS2532: Object is possibly 'undefined'." */
const TSC = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;
/** eslint compact: "/abs/x.ts: line 3, col 1, Error - msg (rule)" */
const ESLINT_COMPACT = /^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(?:Error|Warning)\s+-\s+(.+?)(?:\s+\((.+?)\))?$/;
/** eslint stylish error line: "  3:1  error  msg  rule" (file printed on its own line above) */
const ESLINT_STYLISH_FILE = /^(?:\/|[A-Za-z]:\\|\.{0,2}\/).*\.[jt]sx?$/;
const ESLINT_STYLISH_ROW = /^\s+(\d+):(\d+)\s+(?:error|warning)\s+(.+?)\s{2,}([\w-/@]+)?\s*$/;
/** vitest/jest failed test: "FAIL  test/x.test.ts > suite > name" or "● suite › name" */
const VITEST_FAIL = /FAIL\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?)(?:\s*>\s*(.+))?$/;
const JEST_BULLET = /^\s*●\s+(.+)$/;
const STACK_LOC = /\(?([\w./\\-]+\.[cm]?[jt]sx?):(\d+):(\d+)\)?/;
/** bundler/node unresolved module: webpack/turbopack "Module not found: Can't resolve 'x'", node "Cannot find module 'x'" */
const MODULE_NOT_FOUND = /(?:Module not found: (?:Error: )?Can't resolve|Cannot find module)\s+['"]([^'"]+)['"]/;
/** generic "file:line:col" leader used by many tools (vitest, prettier, next). */
const GENERIC_LOC = /(?:^|\s)([\w./\\-]+\.[a-z]{2,4}):(\d+)(?::(\d+))?/;

const CATEGORY_BY_CHECK: Record<string, ErrorCategory> = {
  typecheck: "type-error",
  lint: "lint-error",
  test: "test-failure",
  build: "build-error",
  format: "format",
  "secret-scan": "security",
  "security-review": "security",
  "decision-check": "decision",
  "architecture-check": "architecture",
  "env-check": "env",
  "route-check": "route",
  deps: "deps",
  smoke: "runtime",
  "perf-check": "performance",
  perf: "performance",
};

/** Stable short fingerprint of an error (file+code+message) for repeat detection. */
export function fingerprint(e: Pick<PreflightError, "file" | "code" | "message">): string {
  const s = `${e.file}|${e.code ?? ""}|${e.message}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Parse a check's combined output into structured errors grouped by file. */
export function parseErrors(check: string, output: string): PreflightError[] {
  const category = CATEGORY_BY_CHECK[check] ?? "unknown";
  const lines = output.split(/\r?\n/);
  const errors: PreflightError[] = [];
  let stylishFile = "";
  const push = (e: Omit<PreflightError, "id" | "category">) =>
    errors.push({ ...e, id: fingerprint(e), category });

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    let m = line.match(TSC);
    if (m) {
      push({ file: m[1]!, line: +m[2]!, column: +m[3]!, code: m[4], message: m[5]!.trim(), raw: line.trim() });
      continue;
    }
    m = line.match(ESLINT_COMPACT);
    if (m) {
      push({ file: m[1]!, line: +m[2]!, column: +m[3]!, code: m[5], message: m[4]!.trim(), raw: line.trim() });
      continue;
    }
    if (ESLINT_STYLISH_FILE.test(line.trim())) {
      stylishFile = line.trim();
      continue;
    }
    m = line.match(ESLINT_STYLISH_ROW);
    if (m && stylishFile) {
      push({ file: stylishFile, line: +m[1]!, column: +m[2]!, code: m[4], message: m[3]!.trim(), raw: line.trim() });
      continue;
    }
    m = line.match(MODULE_NOT_FOUND);
    if (m) {
      const loc = line.match(GENERIC_LOC) ?? lines[li - 1]?.match(GENERIC_LOC);
      push({
        file: loc?.[1] ?? "", line: loc?.[2] ? +loc[2] : undefined, code: "module-not-found",
        message: `Unresolved module "${m[1]}" — the import path or dependency is missing.`, raw: line.trim(),
      });
      continue;
    }
    m = line.match(VITEST_FAIL);
    if (m) {
      push({ file: m[1]!, code: "test-fail", message: m[2] ? `Test failed: ${m[2].trim()}` : "Test file failed.", raw: line.trim() });
      continue;
    }
    m = line.match(JEST_BULLET);
    if (m && /›|>/.test(m[1]!)) {
      // Look ahead a few lines for a stack location to attach a file.
      let file = "";
      let ln: number | undefined;
      for (let j = li + 1; j < Math.min(li + 12, lines.length); j++) {
        const loc = lines[j]!.match(STACK_LOC);
        if (loc) {
          file = loc[1]!;
          ln = +loc[2]!;
          break;
        }
      }
      push({ file, line: ln, code: "test-fail", message: `Test failed: ${m[1]!.trim()}`, raw: line.trim() });
      continue;
    }
  }

  // Fallback: nothing structured parsed but the check failed → keep the signal.
  if (errors.length === 0) {
    const g = output.match(GENERIC_LOC);
    const rawTail = output.trim().split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
    push({
      file: g?.[1] ?? "",
      line: g?.[2] ? +g[2] : undefined,
      message: rawTail || `${check} failed with no parseable output.`,
      raw: rawTail.slice(0, 800),
    });
  }
  // De-dupe identical fingerprints (e.g. a vitest failure echoed in two sections).
  const seen = new Set<string>();
  return errors.filter((e) => (seen.has(e.id!) ? false : (seen.add(e.id!), true)));
}

const PRIORITY_BY_CHECK: Record<string, Priority> = {
  "secret-scan": "critical",
  "security-review": "critical",
  "decision-check": "critical",
  "architecture-check": "critical",
  typecheck: "high",
  build: "high",
  test: "high",
  lint: "medium",
  "route-check": "high",
  "env-check": "medium",
  deps: "medium",
  smoke: "high",
  "perf-check": "medium",
  perf: "medium",
  format: "low",
};

/** Turn parsed errors into agent-directed fix instructions. */
export function toFixInstructions(check: string, errors: PreflightError[]): FixInstruction[] {
  const priority = PRIORITY_BY_CHECK[check] ?? "medium";
  return errors.slice(0, 40).map((e) => {
    const loc = e.file ? `${e.file}${e.line ? `:${e.line}` : ""}` : "(no specific file)";
    return {
      id: e.id ?? fingerprint(e),
      checkId: check,
      priority,
      file: e.file,
      problem: `${check}: ${e.message}`,
      instructionForAgent:
        `Agent, fix this before continuing. In ${loc}, resolve: ${e.message}` +
        (e.code ? ` (${e.code}).` : ".") +
        " Do not commit yet. Run Preflight again after fixing.",
      evidence: `${check} · ${loc}${e.code ? ` · ${e.code}` : ""}`,
    };
  });
}

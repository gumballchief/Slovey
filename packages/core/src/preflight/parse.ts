import type { FixInstruction, Priority, PreflightError } from "./types";

/** tsc: "src/x.ts(12,5): error TS2532: Object is possibly 'undefined'." */
const TSC = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;
/** eslint compact: "/abs/x.ts: line 3, col 1, Error - msg (rule)" */
const ESLINT_COMPACT = /^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(?:Error|Warning)\s+-\s+(.+?)(?:\s+\((.+?)\))?$/;
/** eslint stylish error line: "  3:1  error  msg  rule" (file printed on its own line above) */
const ESLINT_STYLISH_FILE = /^(?:\/|[A-Za-z]:\\|\.{0,2}\/).*\.[jt]sx?$/;
const ESLINT_STYLISH_ROW = /^\s+(\d+):(\d+)\s+(?:error|warning)\s+(.+?)\s{2,}([\w-/@]+)?\s*$/;
/** generic "file:line:col" leader used by many tools (vitest, prettier, next). */
const GENERIC_LOC = /(?:^|\s)([\w./\\-]+\.[a-z]{2,4}):(\d+)(?::(\d+))?/;

/** Parse a check's combined output into structured errors grouped by file. */
export function parseErrors(check: string, output: string): PreflightError[] {
  const lines = output.split(/\r?\n/);
  const errors: PreflightError[] = [];
  let stylishFile = "";

  for (const line of lines) {
    let m = line.match(TSC);
    if (m) {
      errors.push({ file: m[1]!, line: +m[2]!, column: +m[3]!, code: m[4], message: m[5]!.trim() });
      continue;
    }
    m = line.match(ESLINT_COMPACT);
    if (m) {
      errors.push({ file: m[1]!, line: +m[2]!, column: +m[3]!, code: m[5], message: m[4]!.trim() });
      continue;
    }
    if (ESLINT_STYLISH_FILE.test(line.trim())) {
      stylishFile = line.trim();
      continue;
    }
    m = line.match(ESLINT_STYLISH_ROW);
    if (m && stylishFile) {
      errors.push({ file: stylishFile, line: +m[1]!, column: +m[2]!, code: m[4], message: m[3]!.trim() });
      continue;
    }
  }

  // Fallback: nothing structured parsed but the check failed → keep the signal.
  if (errors.length === 0) {
    const g = output.match(GENERIC_LOC);
    const tail = output.trim().split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
    errors.push({
      file: g?.[1] ?? "",
      line: g?.[2] ? +g[2] : undefined,
      message: tail || `${check} failed with no parseable output.`,
    });
  }
  return errors;
}

const PRIORITY_BY_CHECK: Record<string, Priority> = {
  "secret-scan": "critical",
  "decision-check": "critical",
  typecheck: "high",
  build: "high",
  test: "high",
  lint: "medium",
  "route-check": "high",
  "env-check": "medium",
  deps: "medium",
  format: "low",
};

/** Turn parsed errors into agent-directed fix instructions. */
export function toFixInstructions(check: string, errors: PreflightError[]): FixInstruction[] {
  const priority = PRIORITY_BY_CHECK[check] ?? "medium";
  return errors.slice(0, 40).map((e) => {
    const loc = e.file ? `${e.file}${e.line ? `:${e.line}` : ""}` : "(no specific file)";
    return {
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

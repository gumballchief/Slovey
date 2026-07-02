import { readChanged, type RawCheck } from "./checks";
import { fingerprint } from "./parse";
import type { PreflightError } from "./types";

/**
 * The Performance Agent's static pass: a small set of deterministic,
 * high-signal performance footguns in CHANGED files. Deliberately narrow —
 * flagging only patterns that are almost always wrong — so it never becomes
 * the agent everyone ignores. Deeper profiling belongs in a `perf` script
 * (command check) the repo can define.
 */

interface PerfRule {
  code: string;
  /** Only files whose path matches (undefined = all changed source files). */
  pathRe?: RegExp;
  lineRe: RegExp;
  /** Skip a matched line when this also matches (e.g. Promise.all already used). */
  unlessRe?: RegExp;
  message: string;
}

const RULES: PerfRule[] = [
  {
    code: "perf-sync-in-handler",
    pathRe: /(^|\/)(app|pages|api|routes?)\/.*\.(t|j)sx?$/,
    lineRe: /\b(readFileSync|writeFileSync|execSync|execFileSync|spawnSync)\s*\(/,
    message: "Blocking sync call in a request-handling path — this stalls the event loop for every concurrent request. Use the async variant.",
  },
  {
    code: "perf-map-async",
    lineRe: /\.map\s*\(\s*async\b/,
    unlessRe: /Promise\.(all|allSettled)\s*\(/,
    message: ".map(async …) creates unawaited promises — wrap in Promise.all(…) (or use a sequential for…of if order matters).",
  },
  {
    code: "perf-json-deep-clone",
    lineRe: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/,
    // Message must not contain the literal pattern, or this rule flags its own
    // definition file (found by dogfooding).
    message: "JSON round-trip deep-clone is slow and drops Dates/undefined — use structuredClone(…).",
  },
  {
    code: "perf-select-star",
    lineRe: /['"`]\s*SELECT\s+\*\s+FROM\b/i,
    message: "SELECT * fetches every column — select the fields you use.",
  },
];

const SOURCE_FILE = /\.(t|j)sx?$/;
// Test files legitimately contain anti-pattern FIXTURES (found by dogfooding:
// perf-check flagged its own test file's fixtures) and their runtime perf
// rarely matters — skip them.
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test|tests|__tests__)\//;

export function perfCheck(cwd: string, changed: string[]): RawCheck {
  const start = Date.now();
  const errors: PreflightError[] = [];
  for (const { path, content } of readChanged(cwd, changed.filter((f) => SOURCE_FILE.test(f) && !TEST_FILE.test(f)))) {
    const lines = content.split("\n");
    for (const rule of RULES) {
      if (rule.pathRe && !rule.pathRe.test(path)) continue;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!rule.lineRe.test(line)) continue;
        // The mitigating pattern often sits on the previous line —
        // `await Promise.all(\n  items.map(async …` — so test a small window.
        if (rule.unlessRe?.test(`${lines[i - 1] ?? ""}\n${line}`)) continue;
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // comments don't run
        const e = { file: path, line: i + 1, code: rule.code, message: rule.message };
        errors.push({ ...e, id: fingerprint(e), category: "performance", raw: line.trim().slice(0, 200) });
      }
    }
  }
  return { name: "perf-check", command: "", durationMs: Date.now() - start, status: errors.length ? "fail" : "pass", errors };
}

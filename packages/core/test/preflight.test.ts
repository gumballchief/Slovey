import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_BINS,
  evaluateLoop,
  loadPreflightConfig,
  parseErrors,
  redact,
  rejectedKeywordHit,
  runCommand,
  runPreflight,
  scanForSecrets,
  toFixInstructions,
} from "../src/preflight";

function tmp(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "preflight-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe("preflight config", () => {
  it("merges overrides over defaults; missing file → defaults", () => {
    const { config, source } = loadPreflightConfig(tmp(), { maxAttempts: 9 });
    expect(source).toBe("default");
    expect(config.maxAttempts).toBe(9);
    expect(config.requiredChecks).toContain("typecheck");
  });
});

describe("passing preflight + JSON schema", () => {
  it("returns pass + safeToCommit with the required schema shape", async () => {
    const r = await runPreflight({ cwd: tmp({ "package.json": "{}" }), repoId: null, configOverride: { requiredChecks: [], optionalChecks: [] } });
    expect(r.status).toBe("pass");
    expect(r.safeToCommit).toBe(true);
    expect(Array.isArray(r.checks)).toBe(true);
    expect(Array.isArray(r.fixInstructions)).toBe(true);
    expect(Array.isArray(r.decisionViolations)).toBe(true);
    expect(typeof r.summary).toBe("string");
    expect(typeof r.attempt).toBe("number");
    expect(typeof r.agentGuidance).toBe("string");
  });
});

describe("failing typecheck parsing", () => {
  it("parses tsc output into structured, file-scoped errors", () => {
    const errors = parseErrors("typecheck", "src/foo.ts(12,5): error TS2532: Object is possibly 'undefined'.");
    expect(errors[0]).toMatchObject({ file: "src/foo.ts", line: 12, column: 5, code: "TS2532" });
  });
  it("generates agent-directed fix instructions", () => {
    const fixes = toFixInstructions("typecheck", [{ file: "a.ts", line: 3, message: "boom", code: "TS1" }]);
    expect(fixes[0]!.priority).toBe("high");
    expect(fixes[0]!.instructionForAgent).toContain("Agent, fix this before continuing");
    expect(fixes[0]!.instructionForAgent).toContain("Do not commit yet");
    expect(fixes[0]!.instructionForAgent).toContain("Run Preflight again");
  });
});

describe("skipped missing script", () => {
  it("marks a required command with no script as skipped and fails the gate", async () => {
    const dir = tmp({ "package.json": JSON.stringify({ name: "x", scripts: { build: "echo hi" } }) });
    const r = await runPreflight({ cwd: dir, repoId: null, configOverride: { requiredChecks: ["typecheck"], optionalChecks: [] } });
    const tc = r.checks.find((c) => c.name === "typecheck");
    expect(tc?.status).toBe("skipped");
    expect(tc?.skippedReason).toBeTruthy();
    expect(r.status).toBe("fail"); // required + skipped + allowSkippedChecks:false
  });
});

describe("loop safety", () => {
  it("counts repeated failures with the same signature", () => {
    const r = evaluateLoop({ priorRunStatus: "fail", priorAttempt: 2, priorSignature: "X", currentStatus: "fail", currentSignature: "X", maxAttempts: 5 });
    expect(r).toEqual({ attempt: 3, repeated: true, humanReviewRequired: false });
  });
  it("requires human review at max attempts", () => {
    const r = evaluateLoop({ priorRunStatus: "fail", priorAttempt: 4, priorSignature: "X", currentStatus: "fail", currentSignature: "Y", maxAttempts: 5 });
    expect(r.attempt).toBe(5);
    expect(r.humanReviewRequired).toBe(true);
  });
  it("resets the counter after a pass", () => {
    const r = evaluateLoop({ priorRunStatus: "pass", priorAttempt: 3, priorSignature: null, currentStatus: "fail", currentSignature: "Z", maxAttempts: 5 });
    expect(r.attempt).toBe(1);
  });
});

describe("decision violation (rejected pattern)", () => {
  it("detects a rejected term reintroduced in the diff", () => {
    expect(rejectedKeywordHit("Redis was rejected; use CacheService instead.", "import Redis from 'ioredis'")).toBe("redis");
    expect(rejectedKeywordHit("Redis was rejected", "no cache here")).toBeNull();
  });
});

describe("secret handling", () => {
  it("redacts secrets from output", () => {
    expect(redact("using AKIAIOSFODNN7EXAMPLE now")).toContain("[REDACTED]");
    expect(redact("using AKIAIOSFODNN7EXAMPLE now")).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
  it("scans changed source for hardcoded secrets", () => {
    const errs = scanForSecrets([{ path: "a.ts", content: 'const k = "AKIAIOSFODNN7EXAMPLE";' }]);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.file).toBe("a.ts");
  });
});

describe("runner security + timeout", () => {
  it("refuses non-allowlisted binaries and shell metacharacters", async () => {
    expect(ALLOWED_BINS.has("rm")).toBe(false);
    const a = await runCommand(process.cwd(), "rm -rf /", 1000);
    expect(a.ok).toBe(false);
    expect(a.refusedReason).toBeTruthy();
    const b = await runCommand(process.cwd(), "node --version; echo hacked", 1000);
    expect(b.refusedReason).toBeTruthy();
  });
  it("kills a command that exceeds the timeout", async () => {
    const dir = tmp({ "sleep.js": "setTimeout(() => process.exit(0), 3000); setInterval(() => {}, 500);" });
    const r = await runCommand(dir, "node sleep.js", 400);
    expect(r.timedOut).toBe(true);
    expect(r.ok).toBe(false);
  }, 8000);
});

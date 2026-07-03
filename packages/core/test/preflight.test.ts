import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setAI, type AIProvider } from "../src/ai";
import { AGENTS, agentForCheck } from "../src/agents/registry";
import { perfCheck } from "../src/preflight/performance";
import { securityReviewCheck } from "../src/preflight/security";
import {
  ALLOWED_BINS,
  applyOverrides,
  architectureCheck,
  architectureCheckContents,
  defaultConfigJson,
  detectRegression,
  detectUnrelatedChanges,
  distinctiveTerms,
  evaluateLoop,
  fingerprint,
  globToRegex,
  loadPreflightConfig,
  parseErrors,
  redact,
  rejectedKeywordHit,
  rulesFromRejectedDecisions,
  runCommand,
  runPreflight,
  scanForSecrets,
  toEvidenceRefs,
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
    expect(config.decisionChecks.minimumBlockingConfidence).toBe(0.85);
    expect(config.blockPushOnFailure).toBe(true);
  });
  it("deep-merges nested sections instead of wiping them", () => {
    const dir = tmp({ "companybrain.preflight.json": JSON.stringify({ decisionChecks: { minimumBlockingConfidence: 0.5 } }) });
    const { config, source } = loadPreflightConfig(dir);
    expect(source).toBe("file");
    expect(config.decisionChecks.minimumBlockingConfidence).toBe(0.5);
    expect(config.decisionChecks.enabled).toBe(true); // untouched default survives
  });
  it("init config JSON is valid and matches the schema", () => {
    const cfg = JSON.parse(defaultConfigJson());
    expect(cfg.requiredChecks).toContain("decision-check");
    expect(cfg.architectureChecks.enabled).toBe(true);
  });
});

describe("passing preflight + JSON schema", () => {
  it("returns pass + safeToCommit/safeToPush with the v2 schema shape", async () => {
    const r = await runPreflight({ cwd: tmp({ "package.json": "{}" }), repoId: null, configOverride: { requiredChecks: [], optionalChecks: [] } });
    expect(r.status).toBe("pass");
    expect(r.safeToCommit).toBe(true);
    expect(r.safeToPush).toBe(true);
    expect(Array.isArray(r.checks)).toBe(true);
    expect(Array.isArray(r.fixInstructions)).toBe(true);
    expect(Array.isArray(r.decisionViolations)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    expect(Array.isArray(r.nextSteps)).toBe(true);
    expect(typeof r.summary).toBe("string");
    expect(typeof r.agentInstruction).toBe("string");
    expect(typeof r.attempt.attemptNumber).toBe("number");
    expect(typeof r.attempt.remainingAttempts).toBe("number");
    expect(r.project.packageManager).toBeTruthy();
    expect(new Date(r.createdAt).getTime()).toBeGreaterThan(0);
  });
  it("mode:quick drops slow checks and the decision graph", async () => {
    const dir = tmp({ "package.json": JSON.stringify({ scripts: {} }) });
    const r = await runPreflight({
      cwd: dir, repoId: null, mode: "quick",
      configOverride: {
        requiredChecks: ["typecheck", "test", "build"], optionalChecks: [],
        commands: { typecheck: "node --version", test: "node --version", build: "node --version" },
      },
    });
    const names = r.checks.map((c) => c.name);
    expect(names).toContain("typecheck");
    expect(names).not.toContain("test");
    expect(names).not.toContain("build");
    expect(names).not.toContain("decision-check");
    expect(r.mode).toBe("quick");
  });
  it("optional-only failures → status partial, still safe to commit", async () => {
    const dir = tmp({ "package.json": "{}" }); // no lockfile → deps fails
    const r = await runPreflight({ cwd: dir, repoId: null, configOverride: { requiredChecks: [], optionalChecks: ["deps"] } });
    expect(r.checks.find((c) => c.name === "deps")?.status).toBe("fail");
    expect(r.status).toBe("partial");
    expect(r.safeToCommit).toBe(true);
    expect(r.agentInstruction).toContain("safe to commit");
  });
});

describe("failing typecheck parsing", () => {
  it("parses tsc output into structured, categorized, fingerprinted errors", () => {
    const errors = parseErrors("typecheck", "src/foo.ts(12,5): error TS2532: Object is possibly 'undefined'.");
    expect(errors[0]).toMatchObject({ file: "src/foo.ts", line: 12, column: 5, code: "TS2532", category: "type-error" });
    expect(errors[0]!.id).toMatch(/^[0-9a-f]{8}$/);
  });
  it("generates agent-directed fix instructions with ids", () => {
    const fixes = toFixInstructions("typecheck", [{ file: "a.ts", line: 3, message: "boom", code: "TS1" }]);
    expect(fixes[0]!.priority).toBe("high");
    expect(fixes[0]!.id).toBeTruthy();
    expect(fixes[0]!.checkId).toBe("typecheck");
    expect(fixes[0]!.instructionForAgent).toContain("Agent, fix this before continuing");
    expect(fixes[0]!.instructionForAgent).toContain("Do not commit yet");
  });
});

describe("test + build output parsing", () => {
  it("parses vitest FAIL lines", () => {
    const errors = parseErrors("test", "⎯ Failed Tests ⎯\nFAIL  test/foo.test.ts > suite > does the thing");
    expect(errors[0]).toMatchObject({ file: "test/foo.test.ts", code: "test-fail", category: "test-failure" });
    expect(errors[0]!.message).toContain("does the thing");
  });
  it("parses jest bullet failures with a stack location", () => {
    const out = "● suite › fails hard\n\n  expect(received).toBe(1)\n    at Object.<anonymous> (src/x.test.ts:9:15)";
    const errors = parseErrors("test", out);
    expect(errors[0]).toMatchObject({ file: "src/x.test.ts", line: 9, code: "test-fail" });
  });
  it("parses module-not-found build errors", () => {
    const errors = parseErrors("build", "./src/app/page.tsx:3:1\nModule not found: Can't resolve '@/components/Missing'");
    expect(errors[0]!.code).toBe("module-not-found");
    expect(errors[0]!.message).toContain("@/components/Missing");
  });
});

describe("skipped missing script", () => {
  it("marks a required command with no script as skipped and fails the gate", async () => {
    const dir = tmp({ "package.json": JSON.stringify({ name: "x", scripts: { build: "echo hi" } }) });
    const r = await runPreflight({ cwd: dir, repoId: null, configOverride: { requiredChecks: ["typecheck"], optionalChecks: [] } });
    const tc = r.checks.find((c) => c.name === "typecheck");
    expect(tc?.status).toBe("skipped");
    expect(tc?.blocking).toBe(true);
    expect(r.status).toBe("fail"); // required + skipped + allowSkippedChecks:false
    expect(r.safeToCommit).toBe(false);
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
  it("detects unrelated file changes between attempts", () => {
    expect(detectUnrelatedChanges(["a.ts"], ["a.ts", "b.ts"], ["a.ts"])).toBe(true); // b.ts is new + unreferenced
    expect(detectUnrelatedChanges(["a.ts"], ["a.ts", "b.ts"], ["b.ts"])).toBe(false); // b.ts is where the failure is
    expect(detectUnrelatedChanges([], ["a.ts"], [])).toBe(false); // no prior attempt
  });
  it("detects fix regressions (old errors gone, new ones introduced)", () => {
    expect(detectRegression("aaa\nbbb", "ccc")).toBe(true);
    expect(detectRegression("aaa\nbbb", "bbb\nccc")).toBe(false); // still overlapping → not a regression
    expect(detectRegression(null, "ccc")).toBe(false);
  });
});

describe("architecture checks", () => {
  it("flags forbidden imports in changed files", () => {
    const dir = tmp({ "cache.ts": `import Redis from "ioredis";\nexport const r = new Redis();` });
    const c = architectureCheck(dir, ["cache.ts"], [{ type: "forbidden-import", module: "ioredis", reason: "Redis was rejected — use CacheService." }]);
    expect(c.status).toBe("fail");
    expect(c.errors[0]).toMatchObject({ file: "cache.ts", line: 1, code: "arch-import", category: "architecture" });
    expect(c.errors[0]!.message).toContain("CacheService");
  });
  it("flags forbidden content patterns scoped by glob", () => {
    const dir = tmp({ "ui.tsx": "const x = db.query('select 1');" });
    const rules = [{ type: "forbidden-content" as const, pattern: "db\\.query\\(", in: "**/*.tsx", reason: "UI must not access the database directly." }];
    expect(architectureCheck(dir, ["ui.tsx"], rules).status).toBe("fail");
    expect(architectureCheck(dir, ["ui.tsx"], [{ ...rules[0]!, in: "server/**" }]).status).toBe("pass"); // out of scope
  });
  it("flags forbidden paths; zero rules passes vacuously (must not block the gate)", () => {
    const dir = tmp({});
    const c = architectureCheck(dir, ["legacy/auth.ts"], [{ type: "forbidden-path", glob: "legacy/**", reason: "legacy/ was removed; do not reintroduce." }]);
    expect(c.status).toBe("fail");
    // "skipped" would fail a required check — an empty rule set is a valid state.
    expect(architectureCheck(dir, ["a.ts"], []).status).toBe("pass");
  });
  it("glob semantics: * stays in a segment, ** crosses", () => {
    expect(globToRegex("src/*.ts").test("src/a.ts")).toBe(true);
    expect(globToRegex("src/*.ts").test("src/deep/a.ts")).toBe(false);
    expect(globToRegex("src/**").test("src/deep/a.ts")).toBe(true);
  });
});

describe("decision violation (rejected pattern)", () => {
  it("detects a rejected term reintroduced in the diff", () => {
    expect(rejectedKeywordHit("Redis was rejected; use CacheService instead.", "import Redis from 'ioredis'")).toBe("redis");
    expect(rejectedKeywordHit("Redis was rejected", "no cache here")).toBeNull();
  });
  it("classifies evidence strings into typed refs", () => {
    const refs = toEvidenceRefs(["PR #296", "ADR-17", "docs/decisions.md", "https://example.com/x", "we tried it in 2024"]);
    expect(refs.map((r) => r.type)).toEqual(["pr", "adr", "doc", "doc", "decision"]);
    expect(refs[3]!.url).toBe("https://example.com/x");
  });
  it("derives deterministic forbidden-pattern rules from rejected decisions", () => {
    const rules = rulesFromRejectedDecisions([{ id: "d1", decision: "Redis was banned for billing caching." }]);
    expect(rules.length).toBeGreaterThan(0);
    const dir = tmp({ "cache.ts": "import Redis from 'ioredis'" });
    const c = architectureCheck(dir, ["cache.ts"], rules);
    expect(c.status).toBe("fail"); // "Redis" matches case-insensitively via derived rule
    expect(c.errors[0]!.message).toContain("Rejected by team decision");
  });
  it("distinctiveTerms drops connective words and keeps tech tokens", () => {
    const terms = distinctiveTerms("Redis was rejected because it causes operational complexity");
    expect(terms).toContain("redis");
    expect(terms).not.toContain("because");
  });
});

describe("architectureCheckContents (server-side)", () => {
  it("runs rules against in-memory contents with no disk access", () => {
    const c = architectureCheckContents(
      [{ path: "src/billing/cache.ts", content: "import Redis from 'ioredis';" }],
      ["src/billing/cache.ts"],
      [{ type: "forbidden-import", module: "ioredis", reason: "rejected" }],
    );
    expect(c.status).toBe("fail");
    expect(c.errors[0]!.file).toBe("src/billing/cache.ts");
  });
});

describe("smoke check detection", () => {
  it("runs a package.json smoke script as an optional command check", async () => {
    const dir = tmp({ "package.json": JSON.stringify({ scripts: { smoke: "node --version" } }) });
    const r = await runPreflight({ cwd: dir, repoId: null, configOverride: { requiredChecks: [], optionalChecks: ["smoke"] } });
    const smoke = r.checks.find((c) => c.name === "smoke");
    expect(smoke?.status).toBe("pass");
    expect(smoke?.blocking).toBe(false);
    expect(smoke?.command).toContain("smoke");
  });
});

describe("secret handling", () => {
  // Assembled at runtime so Preflight's own secret-scan doesn't flag this test file.
  const fakeAwsKey = ["AKIA", "IOSFODN", "N7EXAMPLE"].join("");
  it("redacts secrets from output", () => {
    expect(redact(`using ${fakeAwsKey} now`)).toContain("[REDACTED]");
    expect(redact(`using ${fakeAwsKey} now`)).not.toContain(fakeAwsKey);
  });
  it("scans changed source for hardcoded secrets but skips .env templates", () => {
    const errs = scanForSecrets([
      { path: "a.ts", content: `const k = "${fakeAwsKey}";` },
      { path: ".env.example", content: `AWS_KEY=${fakeAwsKey}` },
    ]);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.every((e) => e.file === "a.ts")).toBe(true);
  });
});

describe("fingerprints", () => {
  it("is stable for identical errors and distinct otherwise", () => {
    const a = fingerprint({ file: "a.ts", code: "TS1", message: "boom" });
    expect(fingerprint({ file: "a.ts", code: "TS1", message: "boom" })).toBe(a);
    expect(fingerprint({ file: "b.ts", code: "TS1", message: "boom" })).not.toBe(a);
  });
});

describe("agent roster", () => {
  it("matches the pipeline: Build/Security/Decision → Architecture → Performance → Testing → Context", () => {
    const owned = AGENTS.flatMap((a) => a.checks);
    expect(new Set(owned).size).toBe(owned.length); // no double ownership
    expect(agentForCheck("typecheck")).toBe("build");
    expect(agentForCheck("build")).toBe("build");
    expect(agentForCheck("secret-scan")).toBe("security");
    expect(agentForCheck("security-review")).toBe("security");
    expect(agentForCheck("decision-check")).toBe("decision");
    expect(agentForCheck("architecture-check")).toBe("architecture");
    expect(agentForCheck("perf-check")).toBe("performance");
    expect(agentForCheck("test")).toBe("testing");
    expect(agentForCheck("smoke")).toBe("testing");
    expect(agentForCheck("env-check")).toBe("context");
    expect(agentForCheck("route-check")).toBe("context");
  });
});

describe("perf-check (Performance Agent)", () => {
  it("flags sync fs calls in request-handler paths only", () => {
    const dir = tmp({});
    mkdirSync(join(dir, "app", "api"), { recursive: true });
    const handler = 'import { readFileSync } from "node:fs";\nconst x = readFileSync("a.txt");\n';
    writeFileSync(join(dir, "app", "api", "route.ts"), handler);
    writeFileSync(join(dir, "script.ts"), handler); // same code outside a handler path → fine
    const c = perfCheck(dir, ["app/api/route.ts", "script.ts"]);
    expect(c.status).toBe("fail");
    expect(c.errors).toHaveLength(1);
    expect(c.errors[0]).toMatchObject({ file: "app/api/route.ts", code: "perf-sync-in-handler" });
  });
  it("flags .map(async) without Promise.all, JSON deep-clone, SELECT *", () => {
    const dir = tmp({
      "util.ts": [
        "const r = items.map(async (i) => fetch(i));",
        "const clone = JSON.parse(JSON.stringify(obj));",
        'const rows = sql`SELECT * FROM users`;',
        "const ok = await Promise.all(items.map(async (i) => fetch(i)));", // fine
        "// const bad = JSON.parse(JSON.stringify(x)) — comment, ignored",
      ].join("\n"),
    });
    const c = perfCheck(dir, ["util.ts"]);
    expect(c.status).toBe("fail");
    const codes = c.errors.map((e) => e.code).sort();
    expect(codes).toEqual(["perf-json-deep-clone", "perf-map-async", "perf-select-star"]);
  });
});

describe("security-review (AI pass)", () => {
  afterEach(() => setAI(null));
  const fake = (result: unknown | null, throwErr = false): AIProvider => ({
    name: "fake",
    async complete() {
      return "";
    },
    async completeJSON<T>() {
      if (throwErr) throw new Error("provider down");
      return result as T | null;
    },
  });

  it("maps AI findings to security errors and drops low-confidence ones", async () => {
    setAI(
      fake({
        findings: [
          { file: "src/api.ts", line: 12, issue: "SQL built by string concatenation from user input.", severity: "critical", confidence: 0.95 },
          { file: "src/api.ts", issue: "maybe an issue", severity: "low", confidence: 0.3 },
        ],
      }),
    );
    const c = await securityReviewCheck("+ db.query('SELECT * FROM x WHERE id=' + req.params.id)", ["src/api.ts"]);
    expect(c.status).toBe("fail");
    expect(c.errors).toHaveLength(1); // low-confidence dropped
    expect(c.errors[0]).toMatchObject({ file: "src/api.ts", line: 12, category: "security" });
  });
  it("passes on empty findings and skips when the provider is down", async () => {
    setAI(fake({ findings: [] }));
    expect((await securityReviewCheck("+ const x = 1;", ["a.ts"])).status).toBe("pass");
    setAI(fake(null));
    expect((await securityReviewCheck("+ const x = 1;", ["a.ts"])).status).toBe("skipped");
  });
});

describe("human overrides", () => {
  const violation = {
    decisionId: "d1",
    title: "Redis rejected",
    decisionStatus: "rejected" as const,
    violation: "reintroduces redis",
    instructionForAgent: "do not",
    confidence: 0.9,
    evidence: [],
  };
  it("downgrades overridden violations to attributed warnings; others still block", () => {
    const overrides = new Map([
      ["d1", { decisionId: "d1", grantedBy: "youso", reason: "approved for the demo branch", branch: null, expiresAt: null }],
    ]);
    const r = applyOverrides([violation, { ...violation, decisionId: "d2" }], overrides);
    expect(r.blocking).toHaveLength(1);
    expect(r.blocking[0]!.decisionId).toBe("d2");
    expect(r.warnings[0]).toContain("OVERRIDDEN by youso");
    expect(r.warnings[0]).toContain("approved for the demo branch");
  });
  it("no overrides → everything blocks", () => {
    const r = applyOverrides([violation], new Map());
    expect(r.blocking).toHaveLength(1);
    expect(r.warnings).toHaveLength(0);
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
  it("config allowlist permits an exact full command (still metacharacter-guarded)", async () => {
    const denied = await runCommand(process.cwd(), "somebin --check", 3000);
    expect(denied.refusedReason).toBeTruthy();
    const allowed = await runCommand(process.cwd(), "somebin --check", 3000, ["somebin --check"]);
    expect(allowed.refusedReason).toBeUndefined(); // allowed to run; fails at spawn since somebin doesn't exist
    const stillUnsafe = await runCommand(process.cwd(), "somebin --check; rm -rf /", 3000, ["somebin --check; rm -rf /"]);
    expect(stillUnsafe.refusedReason).toContain("unsafe characters");
  });
  it("kills a command that exceeds the timeout", async () => {
    const dir = tmp({ "sleep.js": "setTimeout(() => process.exit(0), 3000); setInterval(() => {}, 500);" });
    const r = await runCommand(dir, "node sleep.js", 400);
    expect(r.timedOut).toBe(true);
    expect(r.ok).toBe(false);
  }, 8000);
});

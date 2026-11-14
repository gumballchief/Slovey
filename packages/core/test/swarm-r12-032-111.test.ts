import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ExtractedDecision } from "../src/ai/types";
import { filterExtractedDecisionsToBatch } from "../src/ai/prompts";
import { perfCheck } from "../src/preflight/performance";

describe("perfCheck with git-quoted paths (round 12, L32)", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("checks a file whose name git quoted because of a space", () => {
    dir = mkdtempSync(join(tmpdir(), "perf-"));
    writeFileSync(join(dir, "my file.ts"), 'const rows = await db.query("SELECT * FROM users");\n');
    const result = perfCheck(dir, ['"my file.ts"']);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.file).toBe("my file.ts");
  });
});

describe("filterExtractedDecisionsToBatch on malformed model JSON (round 12, L111)", () => {
  it("skips null entries and non-array evidence instead of throwing", () => {
    const input = [
      null,
      { decision: "Use pnpm", evidence: "PR #12" },
      { decision: "Use Postgres", evidence: ["PR #12", 7, null] },
    ] as unknown as ExtractedDecision[];
    const out = filterExtractedDecisionsToBatch(input, [12]);
    expect(out).toHaveLength(1);
    expect(out[0]!.decision).toBe("Use Postgres");
    expect(out[0]!.evidence).toEqual(["PR #12"]);
  });
});

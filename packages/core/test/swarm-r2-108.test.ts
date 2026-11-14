import { describe, expect, it } from "vitest";
import { parseErrors, toFixInstructions } from "../src/preflight/parse";

const awsKey = "AKIA" + "IOSFODNN7EXAMPLE";
const ghToken = "ghp_" + "A".repeat(36);
const dbPass = "fake" + "-pw-123";
const dbUrl = "postgres://user:" + dbPass + "@db.example.invalid:5432/app";
const dbKey = "DATABASE" + "_URL";

describe("preflight secret redaction", () => {
  it("redacts secrets from parsed message and raw", () => {
    const errors = parseErrors("secret-scan", `src/config.ts:12: ${awsKey} ${ghToken} ${dbKey}=${dbUrl}`);
    expect(errors.length).toBeGreaterThan(0);
    const blob = errors.map((e) => `${e.message}\n${e.raw ?? ""}`).join("\n");
    expect(blob).not.toContain(awsKey);
    expect(blob).not.toContain(ghToken);
    expect(blob).not.toContain(dbPass);
    expect(blob).not.toContain(dbUrl);
    expect(blob).toContain("[REDACTED]");
    expect(blob).toContain("src/config.ts");
  });

  it("redacts secrets from agent fix instructions", () => {
    const instructions = toFixInstructions("secret-scan", [
      { file: "src/config.ts", line: 12, message: `leaked ${ghToken} and ${awsKey} via ${dbKey}=${dbUrl}` },
    ]);
    const blob = instructions.map((i) => `${i.problem}\n${i.instructionForAgent}`).join("\n");
    expect(blob).not.toContain(ghToken);
    expect(blob).not.toContain(awsKey);
    expect(blob).not.toContain(dbPass);
    expect(blob).toContain("[REDACTED]");
  });

  it("keeps ordinary errors readable", () => {
    const errors = parseErrors("typecheck", "src/x.ts(12,5): error TS2532: Object is possibly 'undefined'.");
    expect(errors[0]?.message).toBe("Object is possibly 'undefined'.");
  });
});

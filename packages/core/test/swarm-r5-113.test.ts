import { describe, it, expect } from "vitest";
import { redact, scanForSecrets } from "../src/preflight/redact";

const FINE_GRAINED_PAT =
  "github_pat_11ABCDEFG0aBcDeFgHiJkL_mNoPqRsTuVwXyZ0123456789abcdEFGH";

describe("R5-113 fine-grained GitHub PAT", () => {
  it("redacts fine-grained PATs from output", () => {
    const out = redact(`token=${FINE_GRAINED_PAT} done`);
    expect(out).not.toContain(FINE_GRAINED_PAT);
    expect(out).toContain("[REDACTED]");
  });

  it("flags fine-grained PATs committed in source", () => {
    const errors = scanForSecrets([
      { path: "src/app.ts", content: `const t = "${FINE_GRAINED_PAT}";` },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("secret");
  });
});

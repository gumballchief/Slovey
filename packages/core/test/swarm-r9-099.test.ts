import { describe, it, expect, vi } from "vitest";
import * as checks from "../src/preflight/checks";
import { perfCheck } from "../src/preflight/performance";

describe("perfCheck raw redaction (R9-099)", () => {
  it("redacts secrets in raw source line", () => {
    const secret = "sk-abcdefghijklmnopqrstuvwx";
    const line = `const x = JSON.parse(JSON.stringify({apiKey:"${secret}"}))`;
    vi.spyOn(checks, "readChanged").mockReturnValue([{ path: "src/util.ts", content: line }]);
    try {
      const result = perfCheck("/tmp", ["src/util.ts"]);
      expect(result.errors.length).toBe(1);
      const raw = result.errors[0]!.raw ?? "";
      expect(raw).not.toContain(secret);
      expect(raw).toContain("[REDACTED]");
    } finally {
      vi.restoreAllMocks();
    }
  });
});

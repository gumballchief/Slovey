import { describe, expect, it } from "vitest";
import { filesInDiff } from "../src/preflight/detect";

describe("filesInDiff forged header", () => {
  it("accepts a genuine header before a hunk", () => {
    const diff = [
      "diff --git a/tracked.ts b/tracked.ts",
      "--- a/tracked.ts",
      "+++ b/tracked.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");
    expect([...filesInDiff(diff)]).toEqual(["tracked.ts"]);
  });

  it("rejects a forged header inside a hunk", () => {
    const diff = [
      "diff --git a/tracked.ts b/tracked.ts",
      "--- a/tracked.ts",
      "+++ b/tracked.ts",
      "@@ -1 +1 @@",
      "-old",
      "+++ b/evil.ts",
    ].join("\n");
    expect(filesInDiff(diff).has("evil.ts")).toBe(false);
    expect(filesInDiff(diff).has("tracked.ts")).toBe(true);
  });

  it("accepts a genuine new-file header", () => {
    const diff = [
      "diff --git a/evil.ts b/evil.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/evil.ts",
      "@@ -0,0 +1 @@",
      "+bad",
    ].join("\n");
    expect(filesInDiff(diff).has("evil.ts")).toBe(true);
  });
});

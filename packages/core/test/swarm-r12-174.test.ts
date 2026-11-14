import { describe, expect, it } from "vitest";
import { rejectedKeywordHit } from "../src/preflight/decisions";

describe("rejectedKeywordHit with non-word trailing characters", () => {
  it("matches a rejected term ending in '+'", () => {
    expect(rejectedKeywordHit("We rejected gcc++ for parsing", "use gcc++ here")).toBe("gcc++");
  });

  it("does not match the term embedded in a longer identifier", () => {
    expect(rejectedKeywordHit("We rejected gcc++ for parsing", "use xgcc++ here")).toBeNull();
    expect(rejectedKeywordHit("We rejected gcc++ for parsing", "use gcc++17 here")).toBeNull();
  });
});

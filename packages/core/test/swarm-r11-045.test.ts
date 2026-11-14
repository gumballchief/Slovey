import { describe, expect, it } from "vitest";
import { scopeScore } from "../src/graph/service";

function decisionWithDirs(directories: string[]) {
  return { services: [], domains: [], languages: [], frameworks: [], directories };
}

describe("R11-045 directory scope canonicalization", () => {
  it("matches ./, leading-slash, backslash and ./ path forms", () => {
    expect(scopeScore(decisionWithDirs(["./src"]), {}, ["src/auth.ts"])).toBeGreaterThan(0);
    expect(scopeScore(decisionWithDirs(["/src"]), {}, ["src/auth.ts"])).toBeGreaterThan(0);
    expect(scopeScore(decisionWithDirs(["src\\"]), {}, ["src/auth.ts"])).toBeGreaterThan(0);
    expect(scopeScore(decisionWithDirs(["src"]), {}, ["./src/auth.ts"])).toBeGreaterThan(0);
  });
});

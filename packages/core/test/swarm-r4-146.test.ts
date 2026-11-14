import { describe, expect, it } from "vitest";
import { runRemotePreflight } from "../src/preflight/remote";

describe("R4-146 remote preflight payload limits", () => {
  it("rejects too many files with 413", async () => {
    const files = Array.from({ length: 300 }, (_, i) => ({ path: `src/${i}.ts`, content: "const x = 1;" }));
    await expect(runRemotePreflight("repo-id", { files })).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects an oversized single file with 413", async () => {
    const files = [{ path: "src/big.ts", content: "x".repeat(300_000) }];
    await expect(runRemotePreflight("repo-id", { files })).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects too many changedFiles with 413", async () => {
    const changedFiles = Array.from({ length: 6000 }, (_, i) => `src/${i}.ts`);
    await expect(runRemotePreflight("repo-id", { changedFiles })).rejects.toMatchObject({ statusCode: 413 });
  });
});

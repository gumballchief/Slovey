import { describe, it, expect, vi, afterEach } from "vitest";
import * as retrieveMod from "../src/pipelines/retrieve";
import * as dbMod from "@company-brain/db";
import { setAI } from "../src/ai";
import type { AIProvider } from "../src/ai";
import { runDecisionCheck } from "../src/preflight/decisions";

describe("R5-096 diff trimming", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setAI(null);
  });

  it("caps the diff fed to retrieve and the AI prompt", async () => {
    const bigDiff = "x".repeat(100000);
    let seenPrompt = "";
    let seenBody = "";
    vi.spyOn(retrieveMod, "retrieveDecisions").mockImplementation(async (_repoId: string, pr: { body?: unknown }) => {
      seenBody = String(pr.body ?? "");
      return [];
    });
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                { id: "rej-1", decision: "Do not use redis for caching", evidence: [], title: "No redis" },
              ]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof dbMod.getDb>;
    vi.spyOn(dbMod, "getDb").mockReturnValue(fakeDb);
    const fakeAI = {
      completeJSON: async (prompt: string) => {
        seenPrompt = prompt;
        return { violations: [] };
      },
    } as unknown as AIProvider;
    setAI(fakeAI);
    await runDecisionCheck("repo-1", bigDiff, ["a.ts"]);
    expect(seenBody.length).toBeLessThanOrEqual(20000);
    expect(seenPrompt.length).toBeLessThan(30000);
  });
});

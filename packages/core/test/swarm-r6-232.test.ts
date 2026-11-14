import { describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.reject(new Error("simulated DB outage")),
        }),
      }),
    }),
  }),
  decisions: { id: "id", decision: "decision", evidence: "evidence", status: "status", repoId: "repoId" },
}));

vi.mock("../src/preflight/detect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/preflight/detect")>();
  return {
    ...actual,
    detectProject: () => ({ type: "unknown", packageManager: "npm", scripts: {}, isNext: false, hasTsconfig: false }),
    getBranch: () => null,
    getCommitSha: () => null,
    getChangedFiles: () => [],
    getDiff: () => "",
  };
});

describe("R6-232 planning-mode DB failure", () => {
  it("does not return pass with empty context when the decision query fails", async () => {
    const { runPreflight } = await import("../src/preflight/engine");
    const result = await runPreflight({
      cwd: "/tmp",
      mode: "planning",
      repoId: "repo-r6-232",
      changedFiles: ["app.ts"],
      persist: false,
    });
    expect(result.status).toBe("error");
    expect(result.summary).toMatch(/Preflight itself failed|simulated DB outage/i);
  });
});

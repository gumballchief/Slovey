import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  agentRuns: { id: "id", status: "status" },
  getDb: vi.fn(),
}));

vi.mock("../src/pipelines/agent", () => ({
  runAgentTask: vi.fn(),
}));

vi.mock("../src/services/sync", () => ({
  resolveRepoById: vi.fn(),
}));

import { getDb } from "@company-brain/db";
import { runAgentTask } from "../src/pipelines/agent";
import { resolveRepoById } from "../src/services/sync";
import { executeAgentRun } from "../src/services/agent-runs";

describe("R2-130 atomic queued-to-running claim", () => {
  it("skips runAgentTask when another worker already claimed the run", async () => {
    const queuedRun = { id: "run-1", repoId: "repo-1", intent: "do thing", status: "queued" };
    // SELECT still sees queued, but atomic UPDATE ... WHERE status='queued' wins for only one worker.
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([queuedRun]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => {
            const p: any = Promise.resolve([]);
            p.returning = () => Promise.resolve([]);
            return p;
          },
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(fakeDb as any);
    vi.mocked(resolveRepoById).mockResolvedValue({
      repoId: "repo-1",
      installationGithubId: 1,
      owner: "o",
      name: "n",
      fullName: "o/n",
      defaultBranch: "main",
    } as any);
    vi.mocked(runAgentTask).mockResolvedValue({ branch: "b", prNumber: 1 } as any);

    await executeAgentRun("run-1");

    expect(vi.mocked(runAgentTask)).not.toHaveBeenCalled();
  });
});

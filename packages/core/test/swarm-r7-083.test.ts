import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/github/app", () => ({ getInstallationOctokit: vi.fn() }));
vi.mock("../src/ai", () => ({ getAI: vi.fn() }));
vi.mock("@company-brain/db", () => ({ getDb: vi.fn(), repoKnowledge: {} }));
vi.mock("../src/pipelines/upsert-decisions", () => ({
  upsertDecisions: vi.fn().mockResolvedValue({ inserted: 0, updated: 0 }),
}));

import { getInstallationOctokit } from "../src/github/app";
import { getAI } from "../src/ai";
import { getDb } from "@company-brain/db";
import { runIndexRepo, MAX_MANIFEST_BYTES } from "../src/pipelines/index-repo";

describe("R7-083 manifest blob size limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAI).mockReturnValue({
      name: "fake",
      complete: async () => "",
      completeJSON: async () => ({ summary: "s" }),
    });
    const tx = {
      delete: () => ({ where: async () => undefined }),
      insert: () => ({ values: async () => undefined }),
    };
    vi.mocked(getDb).mockReturnValue({ transaction: async (fn: (t: unknown) => Promise<void>) => fn(tx) } as never);
  });

  it("skips oversized manifests without fetching/decoding them", async () => {
    expect(MAX_MANIFEST_BYTES).toBeLessThanOrEqual(1_048_576);
    const smallJson = Buffer.from(
      JSON.stringify({ name: "small", dependencies: {}, devDependencies: {} }),
      "utf8",
    ).toString("base64");
    const evilJson = Buffer.from(
      JSON.stringify({ name: "evil", dependencies: { next: "1.0.0" } }),
      "utf8",
    ).toString("base64");
    // Oversized encoded payload that must be skipped before decode+parse.
    const hugeJson = Buffer.from(
      JSON.stringify({
        name: "big",
        dependencies: { next: "1.0.0" },
        pad: "x".repeat(MAX_MANIFEST_BYTES),
      }),
      "utf8",
    ).toString("base64");
    expect(hugeJson.length).toBeGreaterThan(MAX_MANIFEST_BYTES);
    const getBlob = vi.fn(async ({ file_sha }: { file_sha: string }) => {
      if (file_sha === "small-sha") return { data: { content: smallJson, size: 50 } };
      if (file_sha === "large-sha") return { data: { content: evilJson, size: 500_000_000 } };
      return { data: { content: hugeJson, size: hugeJson.length } };
    });
    vi.mocked(getInstallationOctokit).mockResolvedValue({
      rest: {
        git: {
          getTree: async () => ({
            data: {
              truncated: false,
              tree: [
                { type: "blob", path: "package.json", sha: "large-sha", size: 500_000_000 },
                { type: "blob", path: "packages/big/package.json", sha: "huge-content-sha" },
                { type: "blob", path: "apps/web/package.json", sha: "small-sha", size: 50 },
              ],
            },
          }),
          getBlob,
        },
      },
    } as never);
    const result = await runIndexRepo({
      repoId: "r", installationId: 1, owner: "o", name: "n", defaultBranch: "main",
    });
    const calledShas = getBlob.mock.calls.map((c) => (c[0] as { file_sha: string }).file_sha);
    expect(calledShas).not.toContain("large-sha");
    expect(calledShas).toContain("small-sha");
    // Both poisoned manifests declare `next`; if decoded they would add Next.js.
    expect(result.architecture.frameworks).not.toContain("Next.js");
  });
});

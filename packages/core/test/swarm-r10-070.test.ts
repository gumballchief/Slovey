import { describe, expect, it, vi } from "vitest";

vi.mock("../src/preflight/decisions", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/decisions")>();
  return {
    ...orig,
    fetchRejectedDecisions: vi.fn(async () => []),
    runDecisionCheck: vi.fn(async () => ({ violations: [], note: undefined })),
  };
});

vi.mock("../src/preflight/overrides", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/overrides")>();
  return { ...orig, getActiveOverrides: vi.fn(async () => new Map()) };
});

vi.mock("../src/preflight/security", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/security")>();
  return {
    ...orig,
    securityReviewCheck: vi.fn(async () => ({
      name: "security-review",
      command: "",
      durationMs: 0,
      blocking: false,
      status: "pass",
      errors: [],
    })),
  };
});

vi.mock("../src/preflight/persist", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/preflight/persist")>();
  return { ...orig, persistRun: vi.fn(async () => "test-run-id") };
});

import {
  REMOTE_PREFLIGHT_MAX_CHANGED_FILES,
  runRemotePreflight,
} from "../src/preflight/remote";

describe("R10-070 union cap", () => {
  it("rejects 413 when files[]-only path pushes deduped union over the cap", async () => {
    const changedFiles = Array.from(
      { length: REMOTE_PREFLIGHT_MAX_CHANGED_FILES },
      (_, i) => `src/file${i}.ts`,
    );
    const files = [{ path: "legacy/db.ts", content: "hello" }];
    await expect(
      runRemotePreflight("repo-id", { changedFiles, files }),
    ).rejects.toMatchObject({ statusCode: 413 });
  });
});

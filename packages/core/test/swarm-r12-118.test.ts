import { describe, expect, it } from "vitest";
import { RemotePreflightTooLargeError, runRemotePreflight } from "../src/preflight/remote";

describe("remote preflight scalar payload limits", () => {
  it("rejects an oversized branch before any other checks", async () => {
    await expect(runRemotePreflight("repo-1", { branch: "A".repeat(256) })).rejects.toBeInstanceOf(RemotePreflightTooLargeError);
  });
  it("rejects an oversized commitSha", async () => {
    await expect(runRemotePreflight("repo-1", { commitSha: "A".repeat(65) })).rejects.toBeInstanceOf(RemotePreflightTooLargeError);
  });
  it("rejects an oversized attemptId", async () => {
    await expect(runRemotePreflight("repo-1", { attemptId: "A".repeat(129) })).rejects.toBeInstanceOf(RemotePreflightTooLargeError);
  });
});

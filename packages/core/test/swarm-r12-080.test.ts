import { describe, expect, it } from "vitest";
import { RemotePreflightInvalidError, runRemotePreflight } from "../src/preflight/remote";

describe("runRemotePreflight payload validation (L80)", () => {
  it("rejects a null changedFiles entry instead of crashing on p.length", async () => {
    await expect(
      runRemotePreflight("repo-1", { changedFiles: [null as unknown as string] }),
    ).rejects.toBeInstanceOf(RemotePreflightInvalidError);
  });

  it("rejects a non-string changedFiles entry that would bypass length accounting", async () => {
    await expect(
      runRemotePreflight("repo-1", { changedFiles: [{ length: 999999 } as unknown as string] }),
    ).rejects.toThrow(/Invalid changedFiles entry/);
  });

  it("rejects a files entry without string path/content", async () => {
    await expect(
      runRemotePreflight("repo-1", { files: [{ path: "a.ts", content: null as unknown as string }] }),
    ).rejects.toThrow(/Invalid files entry/);
  });
});

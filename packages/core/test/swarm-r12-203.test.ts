import { describe, expect, it } from "vitest";
import { RemotePreflightInvalidError, runRemotePreflight } from "../src/preflight/remote";

describe("runRemotePreflight diff type validation (L203)", () => {
  it("rejects a non-string diff instead of crashing on trim", async () => {
    const payload = JSON.parse('{"diff":123}');
    await expect(runRemotePreflight("repo-id", payload)).rejects.toBeInstanceOf(RemotePreflightInvalidError);
  });
});

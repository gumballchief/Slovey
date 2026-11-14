import { describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@company-brain/db")>();
  return {
    ...orig,
    getDb: () => {
      throw new Error("db should not be reached when scope denies");
    },
  };
});

import { getBilling } from "../src/services/dashboard";

describe("R8-068 getBilling tenancy", () => {
  it("rejects cross-tenant billing reads before touching the db", async () => {
    await expect(
      getBilling("org-B", { login: "attacker", orgIds: ["org-A"] }),
    ).rejects.toThrow(/org not visible/);
  });
});

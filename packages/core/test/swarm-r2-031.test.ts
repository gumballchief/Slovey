import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

describe("R2-031 empty webhook secret fails closed", () => {
  it("rejects forged empty-key signature when secret is missing", async () => {
    vi.resetModules();
    delete process.env.GITHUB_WEBHOOK_SECRET;
    vi.doMock("@company-brain/config", () => ({ loadEnv: () => ({}) }));
    const mod = await import("../src/github/webhooks");
    const rawBody = JSON.stringify({ action: "opened" });
    const forged = `sha256=${createHmac("sha256", "").update(rawBody).digest("hex")}`;
    await expect(mod.verifySignature(rawBody, forged)).resolves.toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

const startMock = vi.hoisted(() => vi.fn());

vi.mock("@company-brain/config", () => ({
  loadDbUrl: () => "postgres://localhost:5432/test?sslmode=require",
}));

vi.mock("pg-boss", () => {
  class FakeBoss {
    on() {}
    start = startMock;
  }
  return { default: FakeBoss };
});

import { getBoss } from "../src/queue/index";

describe("R3-158: failed pg-boss start is not cached", () => {
  it("retries start after a transient failure", async () => {
    startMock.mockRejectedValueOnce(new Error("transient outage"));
    startMock.mockResolvedValueOnce(undefined);
    await expect(getBoss()).rejects.toThrow("transient outage");
    const boss = await getBoss();
    expect(boss).toBeDefined();
    expect(startMock).toHaveBeenCalledTimes(2);
  });
});

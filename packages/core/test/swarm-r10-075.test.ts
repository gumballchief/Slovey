import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/config", () => ({
  loadDbUrl: () => "postgres://localhost:5432/test",
}));

const captured = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }));

vi.mock("pg-boss", () => {
  class FakeBoss {
    on() {}
    async start() {}
    async send(_name: unknown, _data: unknown, opts: Record<string, unknown>) {
      captured.options.push({ ...(opts as Record<string, unknown>) });
      return "job-id";
    }
  }
  return { default: FakeBoss };
});

import { enqueue } from "../src/queue/index.js";
import { JOBS } from "../src/queue/jobs.js";

function lastOptions(): Record<string, unknown> {
  const opt = captured.options[captured.options.length - 1];
  if (!opt) throw new Error("no send captured");
  return opt;
}

describe("R10-075 long-running job expiry", () => {
  beforeEach(() => {
    captured.options.length = 0;
  });

  it("gives extract a much longer expiry than the 10-minute default", async () => {
    await enqueue(JOBS.extract, { installationId: 1, fullName: "a/b" });
    const expire = lastOptions()["expireInSeconds"];
    expect(typeof expire).toBe("number");
    expect(expire as number).toBeGreaterThan(600);
  });

  it("gives refresh_memory and rescan_prs a longer expiry", async () => {
    await enqueue(JOBS.refreshMemory, {});
    expect(lastOptions()["expireInSeconds"] as number).toBeGreaterThan(600);
    await enqueue(JOBS.rescanPrs, {});
    expect(lastOptions()["expireInSeconds"] as number).toBeGreaterThan(600);
  });

  it("keeps the 10-minute default for short jobs", async () => {
    await enqueue(JOBS.checkPr, {
      installationId: 1,
      fullName: "a/b",
      prNumber: 1,
      action: "opened",
    });
    expect(lastOptions()["expireInSeconds"]).toBe(600);
  });

  it("still allows an explicit per-call override to win", async () => {
    await enqueue(JOBS.extract, { installationId: 1, fullName: "a/b" }, { expireInSeconds: 123 });
    expect(lastOptions()["expireInSeconds"]).toBe(123);
  });
});

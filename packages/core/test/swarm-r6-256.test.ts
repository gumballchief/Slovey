import { describe, expect, it, vi } from "vitest";

vi.mock("@company-brain/config", () => ({
  loadDbUrl: () => "postgres://localhost:5432/test",
}));

vi.mock("pg-boss", () => {
  class FakeBoss {
    static instances: Array<FakeBoss> = [];
    static startImpl: (() => Promise<FakeBoss>) | null = null;
    stop = vi.fn(async (): Promise<void> => {});
    send = vi.fn(async (): Promise<string | null> => null);
    on(): void {}
    start = vi.fn(async (): Promise<FakeBoss> => {
      if (FakeBoss.startImpl) return FakeBoss.startImpl();
      return this;
    });
    constructor() {
      FakeBoss.instances.push(this);
    }
  }
  return { default: FakeBoss };
});

import FakeBoss from "pg-boss";
import { getBoss, stopBoss } from "../src/queue/index";

type FakeShape = {
  instances: Array<{ stop: ReturnType<typeof vi.fn> }>;
  startImpl: (() => Promise<never>) | null;
};

const Fake = FakeBoss as unknown as FakeShape;

describe("R6-256 stopBoss during in-flight start", () => {
  it("awaits start then stops the boss", async () => {
    Fake.instances.length = 0;
    let resolveStart!: (v: never) => void;
    Fake.startImpl = () =>
      new Promise<never>((resolve) => {
        resolveStart = resolve;
      });

    const getting = getBoss();
    await Promise.resolve();
    await Promise.resolve();
    expect(Fake.instances.length).toBe(1);

    const stopping = stopBoss();
    await Promise.resolve();
    await Promise.resolve();

    resolveStart(undefined as unknown as never);
    await getting;
    await stopping;

    expect(Fake.instances[0].stop).toHaveBeenCalledOnce();
    Fake.startImpl = null;
  });
});

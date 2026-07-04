import { describe, expect, it, vi } from "vitest";
import { budgetMs, fetchWithTimeout, tryParseJson } from "../src/ai";

describe("AI request budgets", () => {
  it("premium gets a longer budget than cheap", () => {
    expect(budgetMs({ tier: "premium" })).toBeGreaterThan(budgetMs({ tier: "cheap" }));
  });
  it("explicit timeoutMs overrides the tier default", () => {
    expect(budgetMs({ tier: "premium", timeoutMs: 1234 })).toBe(1234);
  });
  it("ignores non-positive overrides", () => {
    expect(budgetMs({ tier: "cheap", timeoutMs: 0 })).toBe(budgetMs({ tier: "cheap" }));
  });
});

describe("fetchWithTimeout", () => {
  it("aborts a hung request and throws a timed-out error", async () => {
    // A fetch that never resolves until aborted — proves the socket can't hang forever.
    const hungFetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", hungFetch);
    try {
      await expect(fetchWithTimeout("https://x", { method: "POST" }, 1000, "TestAI")).rejects.toThrow(
        /TestAI timed out after 1000ms/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns the response when fetch resolves in time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    try {
      const res = await fetchWithTimeout("https://x", {}, 5000);
      expect(await res.text()).toBe("ok");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("tryParseJson", () => {
  it("parses fenced JSON", () => {
    expect(tryParseJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("salvages a JSON object embedded in prose", () => {
    expect(tryParseJson<{ ok: boolean }>('Sure! {"ok":true} hope that helps')).toEqual({ ok: true });
  });
  it("returns undefined (not null) when nothing parses", () => {
    expect(tryParseJson("no json here")).toBeUndefined();
  });
});

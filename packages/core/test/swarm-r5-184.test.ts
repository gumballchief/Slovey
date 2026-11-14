import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../src/ai/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout body deadline", () => {
  it("aborts a body that stalls after headers arrive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start() {
                // Headers arrive, body never emits and ignores the signal.
              },
            }),
            { status: 200, headers: { "content-type": "text/plain" } },
          ),
      ),
    );
    const res = await fetchWithTimeout("https://provider.test/v1", {}, 10, "AI request");
    await expect(res.text()).rejects.toThrow("AI request timed out after 10ms");
  }, 10_000);

  it("returns a promptly-completing body with status and headers intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("hello", {
            status: 201,
            headers: { "x-test": "yes" },
          }),
      ),
    );
    const res = await fetchWithTimeout("https://provider.test/v1", {}, 10, "AI request");
    expect(res.status).toBe(201);
    expect(res.headers.get("x-test")).toBe("yes");
    await expect(res.text()).resolves.toBe("hello");
  });
});

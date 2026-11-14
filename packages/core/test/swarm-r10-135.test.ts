import { describe, expect, it, vi, afterEach } from "vitest";
import { VoyageProvider } from "../src/embeddings/voyage";

describe("VoyageProvider batch order", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns embeddings in input order when API data is out of order", async () => {
    const provider = new VoyageProvider("test-key", "test-model", 3);
    const first = [1, 0, 0];
    const second = [0, 1, 0];
    const third = [0, 0, 1];
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          data: [
            { embedding: third, index: 2 },
            { embedding: first, index: 0 },
            { embedding: second, index: 1 },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await provider.embed(["a", "b", "c"]);
    expect(result).toEqual([first, second, third]);
  });
});

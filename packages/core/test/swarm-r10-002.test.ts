import { describe, it, expect, vi, afterEach } from "vitest";
import { GeminiProvider } from "../src/ai/gemini";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      return handler(url);
    },
  );
}

describe("gemini thought parts", () => {
  it("complete() filters thought:true parts", async () => {
    stubFetch(() =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: "SECRET-THINKING", thought: true },
                { text: "ANSWER" },
              ],
            },
          },
        ],
      }),
    );
    const provider = new GeminiProvider({ apiKey: "k", premiumModel: "m", cheapModel: "m" });
    const text = await provider.complete("hi");
    expect(text).toBe("ANSWER");
  });

  it("completeStream() skips thought:true parts", async () => {
    stubFetch((url) => {
      if (url.includes("streamGenerateContent")) {
        const payload = JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "SECRET-THINKING", thought: true },
                  { text: "ANSWER" },
                ],
              },
            },
          ],
        });
        return new Response(`data: ${payload}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: "FALLBACK" }] } }],
      });
    });
    const provider = new GeminiProvider({ apiKey: "k", premiumModel: "m", cheapModel: "m" });
    const chunks: string[] = [];
    for await (const c of provider.completeStream("hi")) chunks.push(c);
    expect(chunks.join("")).toBe("ANSWER");
  });
});

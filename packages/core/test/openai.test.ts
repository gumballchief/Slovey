import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../src/ai/openai";

const provider = new OpenAIProvider({
  apiKey: "test-key",
  premiumModel: "gpt-4o",
  cheapModel: "gpt-4o-mini",
});

/** Build a fake OpenAI chat response whose assistant content is `text`. */
function chatResponse(text: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAIProvider", () => {
  it("parses a clean JSON object", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chatResponse('{"warn": true, "confidence": "high"}'),
    );
    const out = await provider.completeJSON<{ warn: boolean; confidence: string }>("judge this");
    expect(out).toEqual({ warn: true, confidence: "high" });
  });

  it("salvages a fenced JSON array (extract/consolidate shape)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chatResponse('```json\n[{"decision": "No deploy configs"}]\n```'),
    );
    const out = await provider.completeJSON<Array<{ decision: string }>>("extract");
    expect(Array.isArray(out)).toBe(true);
    expect(out?.[0]?.decision).toBe("No deploy configs");
  });

  it("retries transient 429s then succeeds", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(chatResponse('{"ok": true}'));
    const out = await provider.completeJSON<{ ok: boolean }>("x");
    expect(out).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns null when the model never emits parseable JSON", async () => {
    // Fresh Response per call — a Response body can only be read once.
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      chatResponse("not json at all"),
    );
    const out = await provider.completeJSON("x");
    expect(out).toBeNull();
  });
});

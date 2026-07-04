import { budgetMs, fetchWithTimeout, tryParseJson } from "./http";
import type { AICompleteOptions, AIProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini 3.x flash "thinks" before answering, and those tokens count against
// maxOutputTokens. Thinking can't be disabled on these models, so we reserve
// headroom on top of the caller's requested answer size.
const THINKING_HEADROOM = 2048;

export interface GeminiConfig {
  apiKey: string;
  premiumModel: string;
  cheapModel: string;
}

/**
 * Google Gemini provider (Generative Language API). Implements the same
 * AIProvider interface as Anthropic so pipelines don't change. completeJSON
 * uses responseMimeType=application/json for reliable structured output.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  constructor(private readonly cfg: GeminiConfig) {}

  private model(tier: AICompleteOptions["tier"]) {
    return tier === "cheap" ? this.cfg.cheapModel : this.cfg.premiumModel;
  }

  private async call(prompt: string, opts: AICompleteOptions, jsonMode: boolean): Promise<string> {
    const model = this.model(opts.tier);
    const url = `${BASE}/${model}:generateContent?key=${this.cfg.apiKey}`;
    const generationConfig: Record<string, unknown> = {
      // Reserve thinking headroom so small answer budgets aren't starved.
      maxOutputTokens: (opts.maxTokens ?? 800) + THINKING_HEADROOM,
      temperature: opts.temperature ?? 0,
    };
    if (jsonMode) generationConfig.responseMimeType = "application/json";

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

    const MAX_ATTEMPTS = 3;
    // One overall deadline across all attempts+backoffs so retries can't stack
    // into minutes of silent hang; each fetch gets the remaining budget.
    const deadline = Date.now() + budgetMs(opts);
    const remaining = () => deadline - Date.now();
    let lastErr: unknown = null;
    let retried429 = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (remaining() <= 0) break;
      try {
        const res = await fetchWithTimeout(
          url,
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
          remaining(),
          "Gemini",
        );
        if (!res.ok) {
          const text = await res.text();
          lastErr = new Error(`Gemini ${res.status}: ${text}`);
          if (res.status === 429) {
            // Rate limited. Retry ONCE (don't burn daily quota), honoring the
            // server's retryDelay but capped — large delays mean a daily cap.
            if (retried429) break;
            retried429 = true;
            const m = text.match(/"retryDelay":\s*"(\d+)s"/);
            const delay = m && m[1] ? Math.min(Number(m[1]) * 1000, 15000) : 8000;
            if (delay >= remaining()) break; // no point waiting past the deadline
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
            const delay = 600 * 2 ** (attempt - 1);
            if (delay >= remaining()) break;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          break;
        }
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const parts = data.candidates?.[0]?.content?.parts;
        if (!parts) {
          lastErr = new Error(`Gemini empty response (attempt ${attempt})`);
          continue;
        }
        return parts.map((p) => p.text ?? "").join("");
      } catch (err) {
        lastErr = err;
        const delay = 400 * attempt;
        if (attempt < MAX_ATTEMPTS && delay < remaining()) await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr ?? new Error("Gemini call failed");
  }

  async complete(prompt: string, opts: AICompleteOptions = {}): Promise<string> {
    return this.call(prompt, opts, false);
  }

  async completeJSON<T>(prompt: string, opts: AICompleteOptions = {}): Promise<T | null> {
    // Up to 2 calls, but ONLY re-issue the network request when the first call
    // succeeded yet returned unparseable JSON. A thrown error (timeout / network
    // / rate limit) returns null immediately — retrying the network would just
    // burn another full budget on the same failure and delay the fallback.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.call(prompt, opts, true);
      } catch {
        return null;
      }
      const parsed = tryParseJson<T>(text);
      if (parsed !== undefined) return parsed;
    }
    return null;
  }
}

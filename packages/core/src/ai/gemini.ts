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
    let lastErr: unknown = null;
    let retried429 = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
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
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
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
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw lastErr ?? new Error("Gemini call failed");
  }

  async complete(prompt: string, opts: AICompleteOptions = {}): Promise<string> {
    return this.call(prompt, opts, false);
  }

  async completeJSON<T>(prompt: string, opts: AICompleteOptions = {}): Promise<T | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.call(prompt, opts, true);
      } catch {
        continue;
      }
      try {
        return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
      } catch {
        const match = text.match(/[[{][\s\S]*[\]}]/);
        if (match) {
          try {
            return JSON.parse(match[0]) as T;
          } catch {
            /* retry */
          }
        }
      }
    }
    return null;
  }
}

import { budgetMs, fetchWithTimeout, tryParseJson } from "./http";
import type { AICompleteOptions, AIProvider } from "./types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export interface OpenAIConfig {
  apiKey: string;
  premiumModel: string;
  cheapModel: string;
}

/**
 * OpenAI Chat Completions provider. Implements the same AIProvider interface as
 * Anthropic/Gemini so pipelines are unchanged. Like the Anthropic provider it
 * relies on the prompt asking for JSON + fence-salvage rather than json_object
 * mode, because the extract/consolidate prompts return a top-level array (which
 * OpenAI's json_object mode forbids).
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  constructor(private readonly cfg: OpenAIConfig) {}

  private model(tier: AICompleteOptions["tier"]) {
    return tier === "cheap" ? this.cfg.cheapModel : this.cfg.premiumModel;
  }

  private async call(prompt: string, opts: AICompleteOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: prompt });

    const body: Record<string, unknown> = {
      model: this.model(opts.tier),
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0,
      messages,
    };

    const MAX_ATTEMPTS = 3;
    // One overall deadline across attempts+backoffs; each fetch gets remaining.
    const deadline = Date.now() + budgetMs(opts);
    const remaining = () => deadline - Date.now();
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (remaining() <= 0) break;
      try {
        const res = await fetchWithTimeout(
          ENDPOINT,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${this.cfg.apiKey}`,
            },
            body: JSON.stringify(body),
          },
          remaining(),
          "OpenAI",
        );
        if (!res.ok) {
          const text = await res.text();
          lastErr = new Error(`OpenAI ${res.status}: ${text}`);
          // Back off on rate limits / transient server errors.
          if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
            const delay = 600 * 2 ** (attempt - 1);
            if (delay >= remaining()) break;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          break;
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (content == null) {
          lastErr = new Error(`OpenAI empty response (attempt ${attempt})`);
          continue;
        }
        return content;
      } catch (err) {
        lastErr = err;
        const delay = 400 * attempt;
        if (attempt < MAX_ATTEMPTS && delay < remaining()) await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr ?? new Error("OpenAI call failed");
  }

  async complete(prompt: string, opts: AICompleteOptions = {}): Promise<string> {
    return this.call(prompt, opts);
  }

  async completeJSON<T>(prompt: string, opts: AICompleteOptions = {}): Promise<T | null> {
    // Re-issue the network only when the first call succeeded but returned
    // unparseable JSON; a thrown error returns null so callers fall back.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.call(prompt, opts);
      } catch {
        return null;
      }
      const parsed = tryParseJson<T>(text);
      if (parsed !== undefined) return parsed;
    }
    return null;
  }
}

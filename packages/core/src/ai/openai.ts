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
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.cfg.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          lastErr = new Error(`OpenAI ${res.status}: ${text}`);
          // Back off on rate limits / transient server errors.
          if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
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
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw lastErr ?? new Error("OpenAI call failed");
  }

  async complete(prompt: string, opts: AICompleteOptions = {}): Promise<string> {
    return this.call(prompt, opts);
  }

  async completeJSON<T>(prompt: string, opts: AICompleteOptions = {}): Promise<T | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.call(prompt, opts);
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

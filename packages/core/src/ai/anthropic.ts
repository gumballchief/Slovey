import type { AICompleteOptions, AIProvider } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicConfig {
  apiKey: string;
  /** model id per tier */
  premiumModel: string;
  cheapModel: string;
}

/**
 * Anthropic Messages API provider. Ported from the prototype's pr-check.mjs:
 * same endpoint, headers, two-attempt retry, and ```fence stripping before parse.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  constructor(private readonly cfg: AnthropicConfig) {}

  private model(tier: AICompleteOptions["tier"]) {
    return tier === "cheap" ? this.cfg.cheapModel : this.cfg.premiumModel;
  }

  async complete(prompt: string, opts: AICompleteOptions = {}): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model(opts.tier),
      max_tokens: opts.maxTokens ?? 400,
      messages: [{ role: "user", content: prompt }],
    };
    if (opts.system) body.system = opts.system;
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;

    // Two attempts, matching the prototype's resilience.
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.cfg.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          lastErr = new Error(`Anthropic ${res.status}: ${await res.text()}`);
          continue;
        }
        const data = (await res.json()) as {
          content?: Array<{ text?: string }>;
        };
        if (!data.content) {
          lastErr = new Error(`Anthropic empty response (attempt ${attempt})`);
          continue;
        }
        return data.content.map((c) => c.text ?? "").join("");
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("Anthropic call failed");
  }

  async completeJSON<T>(prompt: string, opts: AICompleteOptions = {}): Promise<T | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.complete(prompt, opts);
      } catch {
        continue;
      }
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleaned) as T;
      } catch {
        // try to salvage the first {...} or [...] block
        const match = text.match(/[[{][\s\S]*[\]}]/);
        if (match) {
          try {
            return JSON.parse(match[0]) as T;
          } catch {
            /* fall through to retry */
          }
        }
      }
    }
    return null;
  }
}

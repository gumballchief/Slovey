import { budgetMs, fetchWithTimeout, tryParseJson } from "./http";
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

    // Two attempts, matching the prototype's resilience — under one overall
    // deadline so a hung socket can't block the gate indefinitely.
    const deadline = Date.now() + budgetMs(opts);
    const remaining = () => deadline - Date.now();
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (remaining() <= 0) break;
      try {
        const res = await fetchWithTimeout(
          ENDPOINT,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": this.cfg.apiKey,
              "anthropic-version": ANTHROPIC_VERSION,
            },
            body: JSON.stringify(body),
          },
          remaining(),
          "Anthropic",
        );
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
    // Re-issue the network only when the first call succeeded but returned
    // unparseable JSON; a thrown error returns null so callers fall back.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await this.complete(prompt, opts);
      } catch {
        return null;
      }
      const parsed = tryParseJson<T>(text);
      if (parsed !== undefined) return parsed;
    }
    return null;
  }
}

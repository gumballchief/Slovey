import { budgetMs, fetchWithTimeout, tryParseJson } from "./http";
import type { AICompleteOptions, AIProvider } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function bodyWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Anthropic timed out after ${ms}ms`)), Math.max(1, ms));
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

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
          lastErr = new Error(`Anthropic ${res.status}: ${await bodyWithTimeout(res.text(), remaining())}`);
          continue;
        }
        const data = (await bodyWithTimeout(res.json(), remaining())) as {
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
    // Share one budget across both attempts so two slow/invalid responses
    // can't block the gate for twice the intended deadline.
    const deadline = Date.now() + budgetMs(opts);
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let text: string;
      try {
        text = await this.complete(prompt, { ...opts, timeoutMs: remaining });
      } catch {
        return null;
      }
      const parsed = tryParseJson<T>(text);
      if (parsed !== undefined) return parsed;
    }
    return null;
  }
}

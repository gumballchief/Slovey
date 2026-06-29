import { loadEnv } from "@company-brain/config";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import type { AIProvider } from "./types";

let _provider: AIProvider | null = null;

/**
 * The active AI provider, selected by AI_PROVIDER. The chosen provider's key is
 * validated here (not in env parsing) so a Gemini-only setup needn't set an
 * Anthropic key, and vice-versa.
 */
export function getAI(): AIProvider {
  if (_provider) return _provider;
  const env = loadEnv();
  if (env.AI_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY required when AI_PROVIDER=gemini");
    _provider = new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      premiumModel: env.GEMINI_MODEL,
      cheapModel: env.GEMINI_MODEL_CHEAP,
    });
  } else if (env.AI_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required when AI_PROVIDER=openai");
    _provider = new OpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      premiumModel: env.OPENAI_CHAT_MODEL,
      cheapModel: env.OPENAI_CHAT_MODEL_CHEAP,
    });
  } else {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required when AI_PROVIDER=anthropic");
    _provider = new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      premiumModel: env.ANTHROPIC_MODEL,
      cheapModel: env.ANTHROPIC_MODEL_CHEAP,
    });
  }
  return _provider;
}

/** For tests: inject a fake provider. */
export function setAI(provider: AIProvider | null) {
  _provider = provider;
}

export * from "./types";
export * from "./prompts";
export { AnthropicProvider } from "./anthropic";
export { GeminiProvider } from "./gemini";
export { OpenAIProvider } from "./openai";

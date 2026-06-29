import type { Confidence } from "@company-brain/config";

/** Cheap model for classify/batch-extract; premium for the judge. */
export type ModelTier = "premium" | "cheap";

export interface AICompleteOptions {
  system?: string;
  maxTokens?: number;
  tier?: ModelTier;
  temperature?: number;
}

/**
 * Provider abstraction so the model is never hardcoded. Anthropic is the
 * default; Gemini/OpenAI can implement the same interface and be swapped via env.
 */
export interface AIProvider {
  readonly name: string;
  complete(prompt: string, opts?: AICompleteOptions): Promise<string>;
  /** Completes and parses JSON, tolerating ```fences. Returns null on failure. */
  completeJSON<T>(prompt: string, opts?: AICompleteOptions): Promise<T | null>;
}

export type Severity = "low" | "medium" | "high" | "critical";

/** The judge's verdict — ported from pr-check.mjs, enriched with severity + a fix. */
export interface JudgeResult {
  warn: boolean;
  confidence: Confidence;
  /** Citation string the model latched onto, e.g. "PR #29499". */
  evidence: string;
  explanation: string;
  /** How serious the conflict is (only meaningful when warn=true). */
  severity?: Severity;
  /** A concise, concrete fix suggestion (optional). */
  suggestedFix?: string;
}

/** A decision the extractor pulled from history. */
export interface ExtractedDecision {
  decision: string;
  why: string;
  examples: string[];
  evidence: string[];
  category?: string;
}

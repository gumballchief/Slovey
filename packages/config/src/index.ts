export { loadEnv, loadDbUrl, bool } from "./env";
export type { Env } from "./env";

/** Confidence levels, ordered. Used by the confidence floor. */
export const CONFIDENCE_ORDER = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE_ORDER)[number];

/** Repo-configurable threshold → the minimum model confidence required to act. */
export const THRESHOLD_TO_MIN_CONFIDENCE = {
  low: "low",
  high: "high",
  strict: "high", // strict also demands a resolved citation + category match (enforced in check.ts)
} as const;
export type ConfidenceThreshold = keyof typeof THRESHOLD_TO_MIN_CONFIDENCE;

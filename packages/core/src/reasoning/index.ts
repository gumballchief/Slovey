export * from "./types";
export { reason, reasonStream, type ReasonStreamEvent } from "./engine";
export { contextForScope } from "./context";
export type { Constraint, EngineeringContext } from "./context";

import { reason, reasonStream, type ReasonStreamEvent } from "./engine";
import type { ReasonedAnswer } from "./types";

/** Engineering Search: natural-language "why don't we use Redis?" over the graph. */
export function engineeringSearch(repoId: string, query: string): Promise<ReasonedAnswer> {
  return reason(repoId, query);
}

/** Streaming Engineering Search: yields answer tokens, then a final resolved answer. */
export function engineeringSearchStream(
  repoId: string,
  query: string,
): AsyncGenerator<ReasonStreamEvent, void, unknown> {
  return reasonStream(repoId, query);
}

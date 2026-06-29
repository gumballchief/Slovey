export * from "./types";
export { reason } from "./engine";
export { contextForScope } from "./context";
export type { Constraint, EngineeringContext } from "./context";

import { reason } from "./engine";
import type { ReasonedAnswer } from "./types";

/** Engineering Search: natural-language "why don't we use Redis?" over the graph. */
export function engineeringSearch(repoId: string, query: string): Promise<ReasonedAnswer> {
  return reason(repoId, query);
}

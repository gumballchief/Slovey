// The Memory Engine — what survives, how it strengthens, and how healthy it is.
// Built on the Decision Graph: scoring + reinforcement + health, no new storage.
export { authorityRank, classifyMemory, memoryScore } from "./score";
export type { MemoryFlags, MemoryLayer, Scorable } from "./score";
export { reinforce } from "./reinforce";
export type { ReinforcementKind } from "./reinforce";
export { memoryHealth } from "./health";
export type { MemoryHealth, DuplicatePair } from "./health";

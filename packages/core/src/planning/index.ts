// The Planning Engine — evidence-backed implementation plans, BEFORE code.
export { plan } from "./engine";
export { classifyIntent, extractScope, assessRisk } from "./classify";
export type { IntentMatch } from "./classify";
export type { EngineeringPlan, PlanIntent, PlanStep, RiskLevel } from "./types";

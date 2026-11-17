/**
 * Slovey's plan catalog: the one place plan names, prices and limits live.
 * The pricing page, checkout, Stripe line items, the webhook and the usage
 * gates all read from here, so a price or a limit can't drift between them.
 *
 * Pure data with no server imports: client components import it too
 * (`@company-brain/core/plans`).
 */

export const PLAN_IDS = ["free", "pro", "team", "business", "scale", "enterprise"] as const;
export type OrgPlan = (typeof PLAN_IDS)[number];

/** Plans bought through Slovey's own Stripe checkout. */
export const PAID_PLAN_IDS = ["pro", "team", "business", "scale"] as const;
export type PaidPlan = (typeof PAID_PLAN_IDS)[number];

export type BillingInterval = "annual" | "monthly";

export interface PlanLimits {
  /** -1 = unlimited. */
  repos: number;
  /** -1 = unlimited. */
  decisions: number;
  /** Agent runs per org per calendar month. -1 = unlimited. */
  agentRuns: number;
}

export interface Plan {
  id: OrgPlan;
  name: string;
  /** One line on who it's for. */
  who: string;
  /**
   * "seat": priced per user. "flat": one price for the workspace, `users` included.
   * "free" and "custom" have no card checkout.
   */
  billing: "free" | "seat" | "flat" | "custom";
  /** Whole dollars per month, billed yearly or monthly. Null for custom pricing. */
  price: { annual: number; monthly: number } | null;
  /** People included on a flat plan. */
  users?: number;
  limits: PlanLimits;
  /** Shown on the pricing card and at checkout. */
  features: string[];
}

const n = (v: number) => v.toLocaleString("en-US");

export const PLANS: Record<OrgPlan, Plan> = {
  free: {
    id: "free",
    name: "Starter",
    who: "For one engineer trying it out",
    billing: "free",
    price: { annual: 0, monthly: 0 },
    limits: { repos: 1, decisions: 200, agentRuns: 20 },
    features: ["1 repository", `${n(200)} decisions remembered`, "20 agent runs a month", "Pre-commit review", "MCP server for your agents"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    who: "For engineers shipping with AI daily",
    billing: "seat",
    price: { annual: 19, monthly: 24 },
    limits: { repos: -1, decisions: 5_000, agentRuns: 500 },
    features: [
      "Unlimited repositories",
      `${n(5_000)} decisions remembered`,
      "500 agent runs a month",
      "Rule checks on every pull request",
      "MCP server and API access",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    who: "For teams that share one memory",
    billing: "seat",
    price: { annual: 49, monthly: 61 },
    limits: { repos: -1, decisions: 25_000, agentRuns: 2_500 },
    features: [
      "Everything in Pro",
      `${n(25_000)} decisions remembered`,
      `${n(2_500)} agent runs a month`,
      "Slack, Notion, Jira and GitHub",
      "Email support",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    who: "For engineering orgs up to 25 people",
    billing: "flat",
    price: { annual: 299, monthly: 375 },
    users: 25,
    limits: { repos: -1, decisions: 100_000, agentRuns: 10_000 },
    features: [
      "Everything in Team",
      "Up to 25 users included",
      `${n(100_000)} decisions remembered`,
      `${n(10_000)} agent runs a month`,
      "Priority support",
    ],
  },
  scale: {
    id: "scale",
    name: "Scale",
    who: "For orgs up to 100 people",
    billing: "flat",
    price: { annual: 799, monthly: 999 },
    users: 100,
    limits: { repos: -1, decisions: -1, agentRuns: 50_000 },
    features: [
      "Everything in Business",
      "Up to 100 users included",
      "Unlimited decisions",
      `${n(50_000)} agent runs a month`,
      "Onboarding call with our team",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    who: "For orgs with strict requirements",
    billing: "custom",
    price: null,
    limits: { repos: -1, decisions: -1, agentRuns: -1 },
    features: ["Unlimited usage", "Self-hosted or VPC", "Audit logs", "SSO and SCIM on request", "A dedicated engineer"],
  },
};

/** Most seats one checkout can buy on a per-seat plan. */
export const MAX_SEATS = 100;

export function isPlan(v: unknown): v is OrgPlan {
  return typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);
}

export function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === "string" && (PAID_PLAN_IDS as readonly string[]).includes(v);
}

/** Plan name for display; unknown values fall back to Starter. */
export function planName(id: string | null | undefined): string {
  return isPlan(id) ? PLANS[id].name : PLANS.free.name;
}

/**
 * What one checkout costs, in whole dollars per billing period.
 * Per-seat plans multiply by seats; flat plans ignore seats.
 */
export function planTotal(id: PaidPlan, interval: BillingInterval, seats: number): number {
  const p = PLANS[id];
  const perMonth = interval === "annual" ? p.price!.annual : p.price!.monthly;
  const months = interval === "annual" ? 12 : 1;
  const qty = p.billing === "seat" ? seats : 1;
  return perMonth * months * qty;
}

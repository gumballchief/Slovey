import { describe, expect, it } from "vitest";
import { PAID_PLAN_IDS, PLAN_IDS, PLANS, isPaidPlan, isPlan, planName, planTotal } from "../src/plans";
import { AGENT_RUNS_PER_MONTH, PLAN_LIMITS } from "../src/services/dashboard";

const big = (n: number) => (n < 0 ? Number.POSITIVE_INFINITY : n);

describe("plan catalog", () => {
  it("has a plan for every id, in ladder order", () => {
    expect(PLAN_IDS).toEqual(["free", "pro", "team", "business", "scale", "enterprise"]);
    for (const id of PLAN_IDS) expect(PLANS[id].id).toBe(id);
  });

  it("never lowers a limit as plans go up", () => {
    for (let i = 1; i < PLAN_IDS.length; i++) {
      const lo = PLANS[PLAN_IDS[i - 1]].limits;
      const hi = PLANS[PLAN_IDS[i]].limits;
      expect(big(hi.repos)).toBeGreaterThanOrEqual(big(lo.repos));
      expect(big(hi.decisions)).toBeGreaterThanOrEqual(big(lo.decisions));
      expect(big(hi.agentRuns)).toBeGreaterThanOrEqual(big(lo.agentRuns));
    }
  });

  it("prices every paid plan, with yearly about 20% under monthly", () => {
    for (const id of PAID_PLAN_IDS) {
      const { annual, monthly } = PLANS[id].price!;
      const saving = 1 - annual / monthly;
      expect(saving).toBeGreaterThan(0.19);
      expect(saving).toBeLessThan(0.22);
    }
    expect(PLANS.enterprise.price).toBeNull();
  });

  it("charges per seat or flat", () => {
    expect(planTotal("pro", "annual", 3)).toBe(19 * 12 * 3);
    expect(planTotal("team", "monthly", 2)).toBe(61 * 2);
    // Flat plans ignore the seat count.
    expect(planTotal("business", "annual", 40)).toBe(299 * 12);
    expect(planTotal("scale", "monthly", 7)).toBe(999);
  });

  it("feeds the limit tables the gates read", () => {
    for (const id of PLAN_IDS) {
      expect(PLAN_LIMITS[id]).toEqual({ repos: PLANS[id].limits.repos, decisions: PLANS[id].limits.decisions });
      expect(AGENT_RUNS_PER_MONTH[id]).toBe(PLANS[id].limits.agentRuns);
    }
  });

  it("rejects anything that is not a plan", () => {
    expect(isPlan("team")).toBe(true);
    expect(isPlan("gold")).toBe(false);
    expect(isPaidPlan("enterprise")).toBe(false);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("scale")).toBe(true);
    expect(isPaidPlan(undefined)).toBe(false);
    expect(planName("nope")).toBe("Starter");
  });
});

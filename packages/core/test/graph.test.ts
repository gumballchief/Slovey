import { describe, expect, it } from "vitest";
import { freshnessScore, isReviewable, scopeScore } from "../src/graph/service";
import { isActiveStatus } from "../src/graph/types";

const DAY = 86_400_000;

describe("freshnessScore", () => {
  const base = { confidence: 0.8, review: "unreviewed" as const, updatedAt: new Date(), now: new Date() };

  it("is zero for non-active (retired/rejected) decisions", () => {
    expect(freshnessScore({ ...base, status: "superseded" })).toBe(0);
    expect(freshnessScore({ ...base, status: "rejected" })).toBe(0);
    expect(freshnessScore({ ...base, status: "deprecated" })).toBe(0);
  });

  it("decays with age for active decisions", () => {
    const now = new Date();
    const fresh = freshnessScore({ ...base, status: "approved", updatedAt: now, now });
    const old = freshnessScore({
      ...base,
      status: "approved",
      updatedAt: new Date(now.getTime() - 365 * DAY),
      now,
    });
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBeCloseTo(0.4, 1); // ~half-life: 0.8 * 0.5
  });

  it("lifts confirmed and penalizes needs_changes", () => {
    const now = new Date();
    const confirmed = freshnessScore({ ...base, status: "approved", review: "confirmed", now });
    const needs = freshnessScore({ ...base, status: "approved", review: "needs_changes", now });
    const neutral = freshnessScore({ ...base, status: "approved", review: "unreviewed", now });
    expect(confirmed).toBeGreaterThan(neutral);
    expect(needs).toBeLessThan(neutral);
  });
});

describe("isActiveStatus", () => {
  it("treats approved/proposed as active, everything else as not", () => {
    expect(isActiveStatus("approved")).toBe(true);
    expect(isActiveStatus("proposed")).toBe(true);
    expect(isActiveStatus("rejected")).toBe(false);
    expect(isActiveStatus("candidate")).toBe(false);
    expect(isActiveStatus("superseded")).toBe(false);
  });
});

describe("scopeScore", () => {
  const d = {
    services: ["billing"],
    domains: ["payments"],
    languages: ["TypeScript"],
    frameworks: ["Next.js"],
    directories: ["apps/web/app/billing"],
  };

  it("scores service + domain overlap, weighted", () => {
    expect(scopeScore(d, { services: ["billing"] }, [])).toBe(3);
    expect(scopeScore(d, { domains: ["payments"] }, [])).toBe(2);
    expect(scopeScore(d, { services: ["billing"], domains: ["payments"] }, [])).toBe(5);
  });

  it("matches a directory prefix against changed paths", () => {
    expect(scopeScore(d, {}, ["apps/web/app/billing/page.tsx"])).toBe(2);
  });

  it("is case-insensitive and zero when nothing matches", () => {
    expect(scopeScore(d, { services: ["BILLING"] }, [])).toBe(3);
    expect(scopeScore(d, { services: ["auth"] }, ["packages/db/schema.ts"])).toBe(0);
  });
});

describe("isReviewable", () => {
  it("queues unconfirmed candidate/proposed/approved decisions", () => {
    expect(isReviewable("proposed", "unreviewed")).toBe(true);
    expect(isReviewable("candidate", "unreviewed")).toBe(true);
    expect(isReviewable("approved", "unreviewed")).toBe(true); // legacy auto-approved
  });

  it("excludes already-reviewed and terminal decisions", () => {
    expect(isReviewable("approved", "confirmed")).toBe(false);
    expect(isReviewable("proposed", "needs_changes")).toBe(false);
    expect(isReviewable("rejected", "unreviewed")).toBe(false);
    expect(isReviewable("superseded", "unreviewed")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { evaluateLoop } from "../src/preflight/engine";

describe("R6-231: blocked unverified prior must not reset loop counter", () => {
  it("continues the streak after a blocked unverified run", () => {
    const r = evaluateLoop({
      priorRunStatus: "unverified",
      priorAttempt: 1,
      priorSignature: "abc",
      currentStatus: "fail",
      currentSignature: "abc",
      maxAttempts: 5,
    });
    expect(r.attempt).toBe(2);
    expect(r.repeated).toBe(true);
    expect(r.humanReviewRequired).toBe(false);
  });

  it("escalates to human review on repeated blocked runs", () => {
    const r = evaluateLoop({
      priorRunStatus: "unverified",
      priorAttempt: 4,
      priorSignature: "abc",
      currentStatus: "fail",
      currentSignature: "abc",
      maxAttempts: 5,
    });
    expect(r.attempt).toBe(5);
    expect(r.humanReviewRequired).toBe(true);
  });

  it("still resets after a pass", () => {
    const r = evaluateLoop({
      priorRunStatus: "pass",
      priorAttempt: 3,
      priorSignature: "abc",
      currentStatus: "fail",
      currentSignature: "abc",
      maxAttempts: 5,
    });
    expect(r.attempt).toBe(1);
    expect(r.repeated).toBe(false);
  });
});

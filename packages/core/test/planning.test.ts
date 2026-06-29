import { describe, expect, it } from "vitest";
import { assessRisk, classifyIntent, extractScope } from "../src/planning/classify";

describe("classifyIntent", () => {
  it("detects migration before feature (specific wins)", () => {
    expect(classifyIntent("Let's migrate Billing to microservices").intent).toBe("migration");
    expect(classifyIntent("switch to Kafka for events").intent).toBe("migration");
  });

  it("detects security intent", () => {
    expect(classifyIntent("add OAuth login").intent).toBe("security");
    expect(classifyIntent("encrypt the stored tokens").intent).toBe("security");
  });

  it("detects performance, database, api, infra, testing, docs", () => {
    expect(classifyIntent("reduce checkout latency").intent).toBe("performance");
    expect(classifyIntent("add an index on the orders table").intent).toBe("database");
    expect(classifyIntent("create a new REST endpoint").intent).toBe("api");
    expect(classifyIntent("deploy to kubernetes").intent).toBe("infrastructure");
    expect(classifyIntent("increase unit test coverage").intent).toBe("testing");
    expect(classifyIntent("update the README and write an ADR").intent).toBe("documentation");
  });

  it("falls back to feature, then unknown", () => {
    expect(classifyIntent("build a dashboard widget").intent).toBe("feature");
    expect(classifyIntent("the weather is nice today").intent).toBe("unknown");
  });

  it("returns the matched token for traceability", () => {
    expect(classifyIntent("add OAuth").matched).toBe("oauth");
    expect(classifyIntent("the weather is nice").matched).toBeNull();
  });
});

describe("extractScope", () => {
  it("extracts languages, frameworks and tech", () => {
    const s = extractScope("Implement Redis caching in our TypeScript React app");
    expect(s.languages).toContain("typescript");
    expect(s.frameworks).toEqual(expect.arrayContaining(["react", "redis"]));
  });

  it("extracts domains and PascalCase services", () => {
    const s = extractScope("Refactor PaymentService for the billing domain");
    expect(s.domains).toContain("billing");
    expect(s.services).toContain("PaymentService");
  });

  it("returns an empty object when nothing matches", () => {
    expect(extractScope("do something nice")).toEqual({});
  });

  it("does not match substrings across word boundaries", () => {
    // "java" must not match inside "javascript"
    const s = extractScope("a javascript change");
    expect(s.languages).toEqual(["javascript"]);
  });
});

describe("assessRisk", () => {
  const base = { intent: "feature" as const, hasRejectedPrecedent: false, constraintCount: 0 };

  it("is high when disallowed or previously rejected", () => {
    expect(assessRisk({ ...base, verdict: "disallowed" })).toBe("high");
    expect(assessRisk({ ...base, verdict: "allowed", hasRejectedPrecedent: true })).toBe("high");
  });

  it("is high for security/migration intents", () => {
    expect(assessRisk({ ...base, intent: "security", verdict: "allowed" })).toBe("high");
    expect(assessRisk({ ...base, intent: "migration", verdict: "unclear" })).toBe("high");
  });

  it("is medium for blast-radius intents and unclear-with-constraints", () => {
    expect(assessRisk({ ...base, intent: "database", verdict: "allowed" })).toBe("medium");
    expect(assessRisk({ ...base, verdict: "unclear", constraintCount: 2 })).toBe("medium");
  });

  it("is low for a plain allowed feature with no constraints", () => {
    expect(assessRisk({ ...base, verdict: "allowed" })).toBe("low");
  });
});

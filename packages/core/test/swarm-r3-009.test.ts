import { describe, expect, it } from "vitest";
import { isRepoVisible } from "../src/services/dashboard";

const victim = { ownerGithubId: 111, owner: "victim-org", orgId: "org-victim" };
const attacker = { githubId: 999, login: "attacker", orgIds: ["org-attacker"] };

describe("R3-009 tenant scoping", () => {
  it("rejects cross-tenant repo", () => {
    expect(isRepoVisible(victim, attacker)).toBe(false);
  });
  it("allows owner via githubId/login/org", () => {
    expect(isRepoVisible(victim, { githubId: 111, login: "someone", orgIds: [] })).toBe(true);
    expect(isRepoVisible(victim, { login: "VICTIM-ORG", orgIds: [] })).toBe(true);
    expect(isRepoVisible(victim, { login: "other", orgIds: ["org-victim"] })).toBe(true);
  });
  it("allows dev without scope", () => {
    expect(isRepoVisible(victim, undefined)).toBe(true);
  });
});

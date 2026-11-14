import { describe, expect, it } from "vitest";
import { listAuditLog, listOrgMembers } from "../src/services/dashboard";

const attackerScope = { login: "attacker", githubId: 12345, orgIds: ["attacker-org-id"] };
const victimOrgId = "victim-org-id";

describe("R7-172 org tenancy", () => {
  it("listOrgMembers rejects org outside caller scope", async () => {
    await expect(listOrgMembers(victimOrgId, attackerScope)).rejects.toThrow(/org not visible/);
  });
  it("listAuditLog rejects org outside caller scope", async () => {
    await expect(listAuditLog(victimOrgId, 50, attackerScope)).rejects.toThrow(/org not visible/);
  });
});

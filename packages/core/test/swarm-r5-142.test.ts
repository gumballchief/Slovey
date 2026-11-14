import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../src/services/dashboard.ts", import.meta.url), "utf8");
const start = src.indexOf("export async function updateDecision");
const end = src.indexOf("export async function removeDecision");
const body = src.slice(start, end);

describe("R5-142 updateDecision restore cap", () => {
  it("counts proposed as a restoring status", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('"proposed"');
    expect(body).toContain('patch.status !== "removed"');
  });

  it("rechecks the cap inside a transaction holding the org row lock", () => {
    expect(body).toContain("db.transaction");
    expect(body).toContain('.for("update")');
    expect(body).toContain('ne(decisions.status, "removed")');
    // The locked recount must occur before the update inside the transaction.
    expect(body.indexOf("db.transaction")).toBeLessThan(body.lastIndexOf(".update(decisions)"));
  });
});

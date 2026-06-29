import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDb,
  decisions,
  getDb,
  installations,
  organizations,
  repos,
} from "@company-brain/db";
import { eq } from "drizzle-orm";
import { dashboard, setEmbeddings, upsertDecisions, type EmbeddingProvider } from "../src";

// Real Neon round-trips: pgvector dedup + ordered retrieval. Off by default (it
// writes to the shared dev DB and needs DATABASE_URL); run with RUN_DB_TESTS=1.
const RUN = Boolean(process.env.RUN_DB_TESTS);

const DIM = 1024;
/** Deterministic one-hot embeddings so cosine distances are exact and testable. */
const fakeEmbeddings: EmbeddingProvider = {
  name: "fake",
  dimensions: DIM,
  async embedOne(text: string) {
    const v = new Array(DIM).fill(0);
    if (text.includes("ALPHA")) v[0] = 1;
    else if (text.includes("BETA")) v[1] = 1;
    else v[2] = 1;
    return v;
  },
  async embed(texts: string[]) {
    return Promise.all(texts.map((t) => this.embedOne(t)));
  },
};

describe.skipIf(!RUN)("DB integration (pgvector dedup + retrieval)", () => {
  const suffix = Date.now();
  let repoId = "";
  let orgId = "";
  let instId = "";

  beforeAll(async () => {
    setEmbeddings(fakeEmbeddings);
    const db = getDb();
    const [org] = await db
      .insert(organizations)
      .values({ name: `itest-${suffix}`, slug: `itest-${suffix}` })
      .returning();
    orgId = org!.id;
    const [inst] = await db
      .insert(installations)
      .values({
        githubInstallationId: Number(String(suffix).slice(-9)),
        accountLogin: `itest-${suffix}`,
        accountType: "Organization",
        orgId,
      })
      .returning();
    instId = inst!.id;
    const [repo] = await db
      .insert(repos)
      .values({
        installationId: instId,
        githubRepoId: Number(String(suffix).slice(-9)),
        owner: "itest",
        name: `r-${suffix}`,
        fullName: `itest/r-${suffix}`,
        defaultBranch: "main",
      })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    if (repoId) {
      const db = getDb();
      await db.delete(repos).where(eq(repos.id, repoId)); // cascades decisions
      await db.delete(installations).where(eq(installations.id, instId));
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    setEmbeddings(null);
    await closeDb();
  });

  it("merges a near-duplicate decision instead of inserting twice", async () => {
    const decA = {
      decision: "ALPHA: deploy configs live outside the repo",
      why: "central deploys",
      examples: [],
      evidence: ["PR #1"],
    };
    const first = await upsertDecisions(repoId, [{ d: decA, source: "github_pr" }]);
    expect(first.inserted).toBe(1);

    // Same embedding (contains ALPHA) → should update the existing row, not insert.
    const second = await upsertDecisions(repoId, [
      { d: { ...decA, evidence: ["PR #2"] }, source: "github_pr" },
    ]);
    expect(second.updated).toBe(1);
    expect(second.inserted).toBe(0);

    // A semantically different decision (BETA) → new row.
    const decB = {
      decision: "BETA: payments are handled internally",
      why: "",
      examples: [],
      evidence: ["PR #3"],
    };
    const third = await upsertDecisions(repoId, [{ d: decB, source: "github_pr" }]);
    expect(third.inserted).toBe(1);

    const all = await getDb().select().from(decisions).where(eq(decisions.repoId, repoId));
    expect(all).toHaveLength(2);
    // The merged row accumulated evidence from both upserts.
    const alpha = all.find((d) => d.decision.includes("ALPHA"))!;
    expect(alpha.evidence).toEqual(expect.arrayContaining(["PR #1", "PR #2"]));
  });

  it("retrieves the closest decision first by vector distance", async () => {
    const results = await dashboard.searchDecisions(repoId, "ALPHA where do deploy configs go");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]!.decision).toContain("ALPHA");
  });
});

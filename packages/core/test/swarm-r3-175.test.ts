import * as Db from "@company-brain/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setEmbeddings } from "../src/embeddings";
import { createDecision } from "../src/services/dashboard";

let liveCount = 200;

function stubSelect(isTx: boolean, cols: any) {
  let fromTable: any = null;
  const builder: any = {};
  builder.from = (t: any) => {
    fromTable = t;
    return builder;
  };
  builder.innerJoin = () => builder;
  builder.where = () => builder;
  builder.limit = () => builder;
  builder.for = () => builder;
  builder.then = (resolve: any, reject: any) => {
    let rows: any[];
    if (fromTable === (Db as any).organizations) {
      rows = [{ plan: "free" }];
    } else if (fromTable === (Db as any).repos) {
      if (cols && typeof cols === "object" && "id" in cols && "slug" in cols) {
        rows = [{ id: "org-1", name: "o", slug: "o" }];
      } else {
        rows = [{ n: 1 }];
      }
    } else if (fromTable === (Db as any).decisions) {
      rows = [{ n: isTx ? liveCount : 199 }];
    } else if (fromTable === (Db as any).memberships) {
      rows = [{ n: 1 }];
    } else if (fromTable === (Db as any).prChecks) {
      rows = cols && typeof cols === "object" && "prs" in cols ? [{ prs: 0, conflicts: 0 }] : [];
    } else {
      rows = [{ n: 0 }];
    }
    return Promise.resolve(rows).then(resolve, reject);
  };
  return builder;
}

function makeRow(v: any) {
  return {
    id: "d-new",
    repoId: "r1",
    decision: v.decision,
    why: v.why ?? "",
    examples: v.examples ?? [],
    evidence: v.evidence ?? [],
    source: v.source ?? "github_pr",
    status: v.status ?? "approved",
    createdAt: new Date(),
  };
}

function makeTx() {
  const tx: any = {};
  tx.select = (cols: any) => stubSelect(true, cols);
  tx.execute = async () => [];
  tx.insert = () => ({
    values: (v: any) => ({
      returning: async () => {
        liveCount += 1;
        return [makeRow(v)];
      },
    }),
  });
  return tx;
}

describe("R3-175 TOCTOU decision cap", () => {
  beforeEach(() => {
    liveCount = 200;
    const fakeDb: any = {
      select: (cols: any) => stubSelect(false, cols),
      execute: async () => [],
      insert: () => ({
        values: (v: any) => ({
          returning: async () => {
            liveCount += 1;
            return [makeRow(v)];
          },
        }),
      }),
      transaction: async (fn: any) => fn(makeTx()),
    };
    vi.spyOn(Db, "getDb").mockReturnValue(fakeDb);
    setEmbeddings({ embedOne: async () => [0.1, 0.2], embedMany: async () => [] } as any);
  });
  it("rejects when cap is reached after embedding", async () => {
    await expect(createDecision("r1", { decision: "d", evidence: ["e"] })).rejects.toThrow(
      /Decision limit reached/,
    );
  });
});

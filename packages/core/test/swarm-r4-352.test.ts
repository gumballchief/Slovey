import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@company-brain/db", () => {
  const installations = {
    orgId: "orgId",
    accountLogin: "accountLogin",
    githubInstallationId: "githubInstallationId",
  };
  const memberships = { orgId: "orgId", userId: "userId", role: "role" };
  const users = { id: "id" };
  const organizations = { slug: "slug", id: "id", githubAccountId: "githubAccountId" };
  type Track = { upserted: string[]; deleteCalls: number; instQueries: number };
  const track: Track = { upserted: [], deleteCalls: 0, instQueries: 0 };
  const holder = globalThis as unknown as { __r4352track?: Track };
  holder.__r4352track = track;
  const db = {
    select: () => ({
      from: (t: unknown) => {
        const where = () => ({
          limit: async () => {
            if (t === users) return [{ id: "user-1" }];
            track.instQueries += 1;
            return [
              { orgId: `org-${track.instQueries}`, accountLogin: "someone-else", orgGithubId: null },
            ];
          },
        });
        return { where, leftJoin: () => ({ where }) };
      },
    }),
    insert: () => ({
      values: (v: { orgId: string }) => ({
        onConflictDoUpdate: async () => {
          track.upserted.push(v.orgId);
        },
        onConflictDoNothing: async () => undefined,
      }),
    }),
    delete: () => ({
      where: async () => {
        track.deleteCalls += 1;
      },
    }),
  };
  return { getDb: () => db, installations, memberships, users, organizations };
});

import { linkUserMemberships } from "../src/services/orgs";

function track() {
  return (globalThis as unknown as {
    __r4352track: { upserted: string[]; deleteCalls: number; instQueries: number };
  }).__r4352track;
}

beforeEach(() => {
  const t = track();
  t.upserted.length = 0;
  t.deleteCalls = 0;
  t.instQueries = 0;
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const page2 = [{ id: 101 }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const s = String(url);
      if (s.includes("page=2")) {
        return {
          ok: true,
          headers: { get: () => null },
          json: async () => ({ installations: page2 }),
        };
      }
      return {
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "link"
              ? '<https://api.github.com/user/installations?per_page=100&page=2>; rel="next"'
              : null,
        },
        json: async () => ({ installations: page1 }),
      };
    }),
  );
});

describe("R4-352 pagination", () => {
  it("fetches all installation pages so memberships beyond 100 are kept", async () => {
    await linkUserMemberships(123, "someone-else", "token");
    expect(track().upserted).toHaveLength(101);
  });
});

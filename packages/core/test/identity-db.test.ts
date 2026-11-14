import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeDb,
  getDb,
  installations,
  memberships,
  organizations,
  repos,
  users,
} from "@company-brain/db";
import { and, eq, inArray } from "drizzle-orm";

// Real-database proof of migration 0020's identity rules: orgs are matched by
// GitHub account id and repos by GitHub repo id, never by a login or name that
// can be renamed and re-registered. Off by default (needs DATABASE_URL with
// 0020 applied); run with RUN_DB_TESTS=1. GitHub itself is faked below.
const RUN = Boolean(process.env.RUN_DB_TESTS);

type Account = { id: number; login: string; type: "User" | "Organization" };
type Repo = { id: number; owner: { login: string; id: number }; name: string; full_name: string; default_branch: string; private: boolean };

const gh = vi.hoisted(() => ({
  accounts: new Map<number, { id: number; login: string; type: string }>(),
  reposByInstall: new Map<number, unknown[]>(),
}));

vi.mock("../src/github/app", () => ({
  getApp: () => ({
    octokit: {
      request: async (_route: string, p: { installation_id: number }) => {
        const account = gh.accounts.get(p.installation_id);
        if (!account) throw Object.assign(new Error("Not Found"), { status: 404 });
        return { data: { account } };
      },
    },
  }),
  getInstallationOctokit: async (installationId: number) => ({
    rest: {
      apps: {
        listReposAccessibleToInstallation: async () => ({
          data: { repositories: gh.reposByInstall.get(installationId) ?? [] },
        }),
      },
    },
  }),
}));

import { syncInstallation } from "../src/services/sync";
import { linkUserMemberships } from "../src/services/orgs";

// Ids far from anything real so a shared dev DB is safe; cleaned up after.
const B = 880_000_000;
const INSTALLS = [B + 1, B + 2, B + 3, B + 4, B + 5, B + 6, B + 7, B + 8];
const ACCOUNTS = [B + 100, B + 200, B + 300, B + 301, B + 400, B + 666, B + 667, B + 900];
const SLUGS = ["zz-acme", "zz-acmeco", "zz-victim", "zz-legacy1", "zz-oldname", "zz-newname", "zz-preset", "zz-other"];

function install(installationId: number, account: Account, repoList: Repo[] = []) {
  gh.accounts.set(installationId, account);
  gh.reposByInstall.set(installationId, repoList);
  return syncInstallation(installationId);
}
function repo(id: number, owner: Account, name: string): Repo {
  return { id, owner: { login: owner.login, id: owner.id }, name, full_name: `${owner.login}/${name}`, default_branch: "main", private: false };
}
async function orgOf(installationId: number) {
  const db = getDb();
  const [row] = await db
    .select({ orgId: installations.orgId })
    .from(installations)
    .where(eq(installations.githubInstallationId, installationId));
  const [org] = await db.select().from(organizations).where(eq(organizations.id, row!.orgId!));
  return org!;
}
async function legacyOrg(slug: string, plan: "free" | "pro" | "enterprise" = "free") {
  const [org] = await getDb().insert(organizations).values({ name: slug, slug, plan }).returning();
  return org!;
}
async function legacyInstall(installationId: number, login: string, orgId: string) {
  await getDb()
    .insert(installations)
    .values({ githubInstallationId: installationId, accountLogin: login, accountType: "Organization", orgId });
}

async function cleanup() {
  const db = getDb();
  await db.delete(installations).where(inArray(installations.githubInstallationId, INSTALLS));
  const slugs = [...SLUGS, ...ACCOUNTS.map((a) => `zz-victim-${a}`)];
  await db.delete(organizations).where(inArray(organizations.slug, slugs));
  await db.delete(organizations).where(inArray(organizations.githubAccountId, ACCOUNTS));
  await db.delete(users).where(inArray(users.githubId, ACCOUNTS));
}

describe.skipIf(!RUN)("identity by immutable GitHub ids (migration 0020)", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });
  beforeEach(() => {
    gh.accounts.clear();
    gh.reposByInstall.clear();
  });

  it("a renamed account keeps its org, and a renamed repo keeps its row", async () => {
    const acme: Account = { id: B + 100, login: "zz-Acme", type: "Organization" };
    await install(B + 1, acme, [repo(B + 7001, acme, "app")]);
    const before = await orgOf(B + 1);
    expect(before.githubAccountId).toBe(B + 100);
    expect(before.slug).toBe("zz-acme");
    const [r1] = await getDb().select().from(repos).where(eq(repos.githubRepoId, B + 7001));

    const renamed: Account = { ...acme, login: "zz-AcmeCo" };
    await install(B + 1, renamed, [repo(B + 7001, renamed, "app2")]);
    const after = await orgOf(B + 1);
    expect(after.id).toBe(before.id);
    expect(after.slug).toBe("zz-acmeco");
    expect(after.name).toBe("zz-AcmeCo");
    const rows = await getDb().select().from(repos).where(eq(repos.githubRepoId, B + 7001));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(r1!.id);
    expect(rows[0]!.fullName).toBe("zz-AcmeCo/app2");
  });

  it("someone re-registering a freed login cannot take over the old org", async () => {
    const victimOrg = await legacyOrg("zz-victim", "pro");
    await legacyInstall(B + 2, "zz-victim", victimOrg.id);
    // The real victim renamed; their installation now reports their new login.
    gh.accounts.set(B + 2, { id: B + 200, login: "zz-victim-renamed", type: "Organization" });

    const attacker: Account = { id: B + 667, login: "zz-victim", type: "User" };
    await getDb().insert(users).values({ githubId: attacker.id, login: attacker.login });
    gh.accounts.set(B + 3, attacker);
    gh.reposByInstall.set(B + 3, []);
    await syncInstallation(B + 3);

    const attackerOrg = await orgOf(B + 3);
    expect(attackerOrg.id).not.toBe(victimOrg.id);
    expect(attackerOrg.slug).toBe(`zz-victim-${B + 667}`);
    const [v] = await getDb().select().from(organizations).where(eq(organizations.id, victimOrg.id));
    expect(v!.githubAccountId).toBeNull();
    expect(v!.plan).toBe("pro");
    const [attackerUser] = await getDb().select().from(users).where(eq(users.githubId, attacker.id));
    const inVictim = await getDb()
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, victimOrg.id), eq(memberships.userId, attackerUser!.id)));
    expect(inVictim).toHaveLength(0);
  });

  it("an uninstalled legacy org is not handed to an organization account it can't verify", async () => {
    const other = await legacyOrg("zz-other");
    await legacyInstall(B + 8, "zz-other", other.id); // GitHub answers 404 for it
    const claimant: Account = { id: B + 900, login: "zz-other", type: "Organization" };
    gh.accounts.set(B + 4, claimant);
    await syncInstallation(B + 4);
    expect((await orgOf(B + 4)).id).not.toBe(other.id);
  });

  it("a legacy org is adopted by its own installation, including after a rename", async () => {
    const legacy = await legacyOrg("zz-legacy1", "pro");
    await legacyInstall(B + 5, "zz-legacy1", legacy.id);
    await install(B + 5, { id: B + 300, login: "zz-legacy1", type: "Organization" });
    const adopted = await orgOf(B + 5);
    expect(adopted.id).toBe(legacy.id);
    expect(adopted.githubAccountId).toBe(B + 300);

    const old = await legacyOrg("zz-oldname", "pro");
    await legacyInstall(B + 6, "zz-oldname", old.id);
    await install(B + 6, { id: B + 301, login: "zz-newname", type: "Organization" });
    const kept = await orgOf(B + 6);
    expect(kept.id).toBe(old.id);
    expect(kept.slug).toBe("zz-newname");
    expect(kept.plan).toBe("pro");
  });

  it("an org set up by hand before any install is picked up by that account", async () => {
    const preset = await legacyOrg("zz-preset", "enterprise");
    await install(B + 7, { id: B + 400, login: "zz-preset", type: "Organization" });
    const org = await orgOf(B + 7);
    expect(org.id).toBe(preset.id);
    expect(org.plan).toBe("enterprise");
    expect(org.githubAccountId).toBe(B + 400);
  });

  it("a new repo taking a stale full name never inherits the old repo's row", async () => {
    const acme: Account = { id: B + 100, login: "zz-AcmeCo", type: "Organization" };
    // zz-AcmeCo/app2 belongs to repo 7001 (first test). A different repo now has that name.
    await install(B + 1, acme, [repo(B + 7002, acme, "app2")]);
    const [moved] = await getDb().select().from(repos).where(eq(repos.githubRepoId, B + 7001));
    const [fresh] = await getDb().select().from(repos).where(eq(repos.githubRepoId, B + 7002));
    expect(fresh!.fullName).toBe("zz-AcmeCo/app2");
    expect(moved!.fullName).toBe(`zz-AcmeCo/app2 (moved ${B + 7001})`);
    expect(moved!.id).not.toBe(fresh!.id);
  });

  it("membership owner role follows the account id, not the login", async () => {
    const db = getDb();
    // B+1 is linked to the org with account id B+100 (renamed to zz-AcmeCo).
    const [realOwner] = await db.insert(users).values({ githubId: B + 100, login: "zz-renamed-again" }).returning();
    const [impostor] = await db.insert(users).values({ githubId: B + 666, login: "zz-AcmeCo" }).returning();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ installations: [{ id: B + 1 }] }),
      })),
    );
    try {
      await linkUserMemberships(B + 100, "zz-renamed-again", "token");
      await linkUserMemberships(B + 666, "zz-AcmeCo", "token");
    } finally {
      vi.unstubAllGlobals();
    }
    const org = await orgOf(B + 1);
    const roleOf = async (userId: string) =>
      (await db.select({ role: memberships.role }).from(memberships).where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId))))[0]?.role;
    expect(await roleOf(realOwner!.id)).toBe("owner");
    expect(await roleOf(impostor!.id)).toBe("member");
  });
});

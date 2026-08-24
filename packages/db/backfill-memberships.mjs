/**
 * One-time backfill: create the owner membership for personal-account App
 * installations that never got one.
 *
 * Why: membership rows were only ever created at GitHub sign-in
 * (linkUserMemberships). Anyone who installed the App and then signed in with
 * Google — or installed it after signing in — had no membership, so every API
 * call (CLI preflight, MCP knowledge) returned 403 "access revoked" on their own
 * repositories. The install flow now creates this row itself (services/sync.ts);
 * this fixes the accounts that predate that change.
 *
 * Lives in packages/db so the `postgres` driver resolves. Safe to run
 * repeatedly: additive and idempotent (ON CONFLICT DO NOTHING).
 *
 * Run from the company-brain root:
 *   node --env-file=.env packages/db/backfill-memberships.mjs
 */
import postgres from "postgres";

// .env declares DATABASE_URL twice (Neon then Supabase); --env-file keeps the
// last, which is the live Supabase database. Guard in case it is unset.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run: node --env-file=.env packages/db/backfill-memberships.mjs");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require", max: 1 });

try {
  const before = (await sql`select count(*)::int as n from memberships`)[0].n;
  const inserted = await sql`
    insert into memberships (org_id, user_id, role)
    select distinct i.org_id, u.id, 'owner'::membership_role
    from installations i
    join repos r on r.installation_id = i.id
    join users u on u.github_id = r.owner_github_id
    where i.account_type = 'User'
    on conflict (org_id, user_id) do nothing
    returning org_id, user_id`;
  const after = (await sql`select count(*)::int as n from memberships`)[0].n;
  console.log(`memberships: ${before} -> ${after}`);
  console.log(`created ${inserted.length} row(s):`);
  for (const row of inserted) console.log(`  org ${row.org_id}  user ${row.user_id}`);
} catch (e) {
  console.error("backfill failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}

import { loadEnv } from "@company-brain/config";
import { auditLogs, closeDb, getDb, prChecks } from "@company-brain/db";
import { desc } from "drizzle-orm";

/** Show the most recent activity in the DB (to confirm the deployed worker ran). */
async function main() {
  loadEnv();
  const db = getDb();
  console.log("now:", new Date().toISOString());
  console.log("--- recent audit_logs ---");
  for (const r of await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6)) {
    console.log(`  ${r.createdAt.toISOString()}  ${r.action}  by=${r.actorUser}  ${JSON.stringify(r.metadata)}`);
  }
  console.log("--- recent pr_checks ---");
  for (const r of await db.select().from(prChecks).orderBy(desc(prChecks.checkedAt)).limit(6)) {
    console.log(`  ${r.checkedAt.toISOString()}  PR#${r.prNumber}  ${r.verdict}  posted=${r.posted}`);
  }
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});

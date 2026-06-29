import { loadEnv } from "@company-brain/config";
import { resolveRepo } from "@company-brain/core";
import { closeDb, feedback, getDb } from "@company-brain/db";
import { eq } from "drizzle-orm";

/** Remove the erroneous bot self-dismissal feedback. */
async function main() {
  loadEnv();
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) throw new Error("repo not found");
  const del = await getDb()
    .delete(feedback)
    .where(eq(feedback.repoId, repo.repoId))
    .returning({ id: feedback.id });
  console.log(`Deleted ${del.length} feedback row(s).`);
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});

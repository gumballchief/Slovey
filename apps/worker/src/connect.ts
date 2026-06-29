import { loadEnv } from "@company-brain/config";
import { resolveRepo, runIngestConnector, saveConnector } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/**
 * Connect a source + run an immediate ingest (what the web UI does, from the CLI).
 * Usage: tsx src/connect.ts <owner/repo> <linear|notion|slack> <token>
 */
async function main() {
  loadEnv();
  const [full, type, token] = process.argv.slice(2);
  if (!full || !type || !token) {
    throw new Error("usage: tsx src/connect.ts <owner/repo> <linear|notion|slack> <token>");
  }
  const repo = await resolveRepo(full);
  if (!repo) throw new Error(`repo not found: ${full}`);
  const conn = await saveConnector(repo.repoId, type, token);
  console.log(`saved connector ${conn.type} (${conn.id})`);
  const r = await runIngestConnector({ repoId: repo.repoId, connectorId: conn.id });
  console.log("ingest result:", r);
  await closeDb();
}

main().catch(async (e) => {
  console.error("connect failed:", e);
  await closeDb();
  process.exit(1);
});

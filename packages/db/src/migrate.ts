import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, getSql, closeDb } from "./client";

/**
 * Run migrations. Ensures the pgvector extension exists first (Drizzle can't
 * create extensions itself), then applies the generated SQL in ./drizzle.
 */
async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = getSql();
  console.log("Ensuring pgvector extension…");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("Running migrations…");
  await migrate(getDb(), { migrationsFolder: resolve(here, "../drizzle") });
  console.log("Migrations complete.");
  await closeDb();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await closeDb();
  process.exit(1);
});

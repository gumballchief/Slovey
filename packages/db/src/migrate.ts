import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDirectSql } from "./client";

/**
 * Run migrations. Ensures the pgvector extension exists first (Drizzle can't
 * create extensions itself), then applies the generated SQL in ./drizzle.
 * Always connects via DATABASE_URL directly — never the transaction pooler,
 * which can't run DDL/migration sessions.
 */
const sql = createDirectSql();

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  console.log("Ensuring pgvector extension…");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("Running migrations…");
  await migrate(drizzle(sql), { migrationsFolder: resolve(here, "../drizzle") });
  console.log("Migrations complete.");
  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await sql.end({ timeout: 5 });
  process.exit(1);
});

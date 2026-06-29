import { loadDbUrl } from "@company-brain/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

/** Lazily-created, process-wide Drizzle client. */
export function getDb() {
  if (_db) return _db;
  _sql = postgres(loadDbUrl(), { max: 10, prepare: false });
  _db = drizzle(_sql, { schema });
  return _db;
}

/** Raw postgres-js handle, for migrations and `CREATE EXTENSION`. */
export function getSql() {
  if (!_sql) getDb();
  return _sql!;
}

export async function closeDb() {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _db = null;
  }
}

export type Database = ReturnType<typeof getDb>;

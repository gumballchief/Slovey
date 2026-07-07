import { loadDbUrl, loadPooledDbUrl } from "@company-brain/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

/** Lazily-created, process-wide Drizzle client. Pool size is env-tunable
 *  (DB_POOL_MAX) so the memory-constrained worker can run a small pool while the
 *  web service keeps a larger one. Connects via DATABASE_URL_POOLED when set
 *  (transaction pooler — no session cap; prepare:false keeps us compatible),
 *  falling back to DATABASE_URL. */
export function getDb() {
  if (_db) return _db;
  const max = Number(process.env.DB_POOL_MAX) || 10;
  _sql = postgres(loadPooledDbUrl(), { max, prepare: false });
  _db = drizzle(_sql, { schema });
  return _db;
}

/**
 * Dedicated direct (session-mode) connection on DATABASE_URL, for migrations
 * and DDL — transaction poolers can't run them. Caller owns the handle and
 * must `.end()` it.
 */
export function createDirectSql() {
  return postgres(loadDbUrl(), { max: 1, prepare: false });
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

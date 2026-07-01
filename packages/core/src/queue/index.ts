import { loadDbUrl } from "@company-brain/config";
import PgBoss from "pg-boss";
import { logger } from "../logger";
import type { JobName, JobPayloads } from "./jobs";

let _boss: PgBoss | null = null;
let _started: Promise<PgBoss> | null = null;

/** Process-wide pg-boss instance (Postgres-backed queue; no Redis). */
export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  if (_started) return _started;
  // Supabase's pooler presents a cert chain Node doesn't trust by default, and
  // node-postgres now treats `sslmode=require` as strict `verify-full` — which
  // rejects it ("self-signed certificate in certificate chain"). Strip the
  // sslmode param (it would otherwise override) and set TLS explicitly without
  // CA verification, matching the postgres.js client in packages/db.
  const dbUrl = new URL(loadDbUrl());
  dbUrl.searchParams.delete("sslmode");
  const boss = new PgBoss({ connectionString: dbUrl.toString(), ssl: { rejectUnauthorized: false } });
  boss.on("error", (e) => logger.error("pg-boss error", { err: e }));
  _started = boss.start().then(() => {
    _boss = boss;
    return boss;
  });
  return _started;
}

/**
 * Default job durability: retry transient failures with backoff, expire stuck
 * jobs, and keep finished jobs briefly for inspection. Per-call options override.
 */
const DEFAULT_SEND_OPTIONS: PgBoss.SendOptions = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 600,
  retentionMinutes: 60 * 24,
};

/** Type-safe enqueue. Called from the webhook route handler. */
export async function enqueue<N extends JobName>(
  name: N,
  data: JobPayloads[N],
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(name, data as object, { ...DEFAULT_SEND_OPTIONS, ...options });
}

export async function stopBoss() {
  if (_boss) {
    await _boss.stop({ graceful: true });
    _boss = null;
    _started = null;
  }
}

export * from "./jobs";

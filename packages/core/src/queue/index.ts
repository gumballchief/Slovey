import { loadDbUrl } from "@company-brain/config";
import PgBoss from "pg-boss";
import { logger } from "../logger";
import { JOBS } from "./jobs";
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
  // pg-boss opens its OWN pool (default max 10) on top of the postgres.js client
  // pool — up to 20 connections, each with buffers. Cap it (PGBOSS_MAX) so the
  // 512MB worker doesn't blow its memory budget on idle connections.
  const max = Number(process.env.PGBOSS_MAX) || 10;
  // If the Supabase CA bundle is provided (SUPABASE_CA, PEM text), verify the
  // server for real; without it, keep the encrypted-but-unverified connection
  // that production relies on today.
  const ca = process.env.SUPABASE_CA;
  const boss = new PgBoss({
    connectionString: dbUrl.toString(),
    ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: false },
    max,
  });
  boss.on("error", (e) => logger.error("pg-boss error", { err: e }));
  _started = boss.start().then(() => {
    _boss = boss;
    return boss;
  }).catch((err) => {
    _started = null;
    throw err;
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

/** Long-running extraction jobs outlive the 10-minute default expiry. */
const LONG_EXPIRE_IN_SECONDS = 3600;

const LONG_RUNNING_JOBS: ReadonlySet<JobName> = new Set([
  JOBS.extract,
  JOBS.refreshMemory,
  JOBS.rescanPrs,
]);

/** Type-safe enqueue. Called from the webhook route handler. */
export async function enqueue<N extends JobName>(
  name: N,
  data: JobPayloads[N],
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  const base = LONG_RUNNING_JOBS.has(name)
    ? { ...DEFAULT_SEND_OPTIONS, expireInSeconds: LONG_EXPIRE_IN_SECONDS }
    : DEFAULT_SEND_OPTIONS;
  return boss.send(name, data as object, { ...base, ...options });
}

export async function stopBoss() {
  if (_started) {
    try {
      await _started;
    } catch {
      // start failed; _started was already cleared by getBoss
    }
  }
  if (_boss) {
    await _boss.stop({ graceful: true });
    _boss = null;
    _started = null;
  }
}

export * from "./jobs";

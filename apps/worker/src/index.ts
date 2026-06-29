import { loadEnv } from "@company-brain/config";
import {
  JOBS,
  checkPr,
  getBoss,
  logger as rootLogger,
  recordFeedback,
  resolveRepo,
  runExtract,
  runIndexRepo,
  runIngestConnector,
  runRefreshMemory,
  runRescanPrs,
  syncInstallation,
  type CheckPrJob,
  type ExtractJob,
  type FeedbackJob,
  type IngestConnectorJob,
  type RefreshMemoryJob,
  type RescanPrsJob,
  type SyncInstallationJob,
} from "@company-brain/core";
import type PgBoss from "pg-boss";

const log = rootLogger.child({ component: "worker" });

async function main() {
  loadEnv(); // fail fast on bad config
  const boss = await getBoss();
  log.info("pg-boss started");

  // pg-boss v10 requires queues to exist before work/send.
  for (const q of Object.values(JOBS)) await boss.createQueue(q);

  await boss.work<SyncInstallationJob>(JOBS.syncInstallation, async ([job]) => {
    if (!job) return;
    log.info("sync installation", { installationId: job.data.installationId });
    await syncInstallation(job.data.installationId);
  });

  await boss.work<ExtractJob>(JOBS.extract, async ([job]) => {
    if (!job) return;
    const repo = await resolveRepo(job.data.fullName);
    if (!repo) {
      log.warn("extract: unknown repo", { fullName: job.data.fullName });
      return;
    }
    log.info("extract start", { repo: repo.fullName });
    const r = await runExtract({
      repoId: repo.repoId,
      installationId: repo.installationGithubId,
      owner: repo.owner,
      name: repo.name,
      defaultBranch: repo.defaultBranch,
      prLimit: job.data.prLimit,
    });
    log.info("extract done", { repo: repo.fullName, ...r });
    // Also index the repo's code structure (Company Brain knowledge engine).
    try {
      const k = await runIndexRepo({
        repoId: repo.repoId,
        installationId: repo.installationGithubId,
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
      });
      log.info("index done", {
        repo: repo.fullName,
        files: k.architecture.fileCount,
        frameworks: k.architecture.frameworks,
        conventions: k.conventions,
      });
    } catch (e) {
      log.warn("index failed", { repo: repo.fullName, err: e });
    }
  });

  await boss.work<CheckPrJob>(JOBS.checkPr, async ([job]) => {
    if (!job) return;
    const repo = await resolveRepo(job.data.fullName);
    if (!repo) {
      log.warn("check: unknown repo", { fullName: job.data.fullName });
      return;
    }
    log.info("check start", { repo: repo.fullName, pr: job.data.prNumber });
    const r = await checkPr({
      repoId: repo.repoId,
      installationId: repo.installationGithubId,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      prNumber: job.data.prNumber,
      action: job.data.action,
    });
    log.info("check done", { repo: repo.fullName, pr: job.data.prNumber, ...r });
  });

  await boss.work<FeedbackJob>(JOBS.feedback, async ([job]) => {
    if (!job) return;
    const repo = await resolveRepo(job.data.fullName);
    if (!repo) {
      log.warn("feedback: unknown repo", { fullName: job.data.fullName });
      return;
    }
    await recordFeedback({
      repoId: repo.repoId,
      prNumber: job.data.prNumber,
      action: job.data.action,
      byUser: job.data.byUser,
      reason: job.data.reason,
    });
    log.info("feedback recorded", { repo: repo.fullName, pr: job.data.prNumber, action: job.data.action });
  });

  await boss.work<IngestConnectorJob>(JOBS.ingestConnector, async ([job]) => {
    if (!job) return;
    log.info("connector ingest start", { repoId: job.data.repoId, connectorId: job.data.connectorId });
    const r = await runIngestConnector(job.data);
    log.info("connector ingest done", { connectorId: job.data.connectorId, ...r });
  });

  await boss.work<RescanPrsJob>(JOBS.rescanPrs, async ([job]) => {
    if (!job) return;
    log.info("rescan start", { repoId: job.data.repoId ?? "all" });
    const r = await runRescanPrs(job.data.repoId);
    log.info("rescan done", { ...r });
  });

  await boss.work<RefreshMemoryJob>(JOBS.refreshMemory, async ([job]) => {
    if (!job) return;
    log.info("refresh start", { repoId: job.data.repoId ?? "all" });
    const r = await runRefreshMemory(job.data.repoId);
    log.info("refresh done", { ...r });
  });

  // Periodic sweeps (pg-boss cron; persisted + idempotent across restarts).
  // Re-check open PRs often (decisions/dismissals change between pushes); refresh
  // memory slowly (re-extract merged history). Override cadence via env if needed.
  const rescanCron = process.env.RESCAN_CRON ?? "0 */6 * * *"; // every 6h
  const refreshCron = process.env.REFRESH_CRON ?? "0 3 * * *"; // daily 03:00 UTC
  await boss.schedule(JOBS.rescanPrs, rescanCron, {}, { tz: "UTC" });
  await boss.schedule(JOBS.refreshMemory, refreshCron, {}, { tz: "UTC" });
  log.info("schedules registered", { rescanCron, refreshCron });

  log.info("handlers registered; waiting for jobs");
}

main().catch((err) => {
  log.error("worker fatal", { err });
  process.exit(1);
});

// graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    const boss = (await getBoss()) as PgBoss;
    await boss.stop({ graceful: true });
    process.exit(0);
  });
}

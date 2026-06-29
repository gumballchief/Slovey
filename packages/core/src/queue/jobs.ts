/** Job name constants + payload contracts, shared by web (enqueue) and worker (consume). */
export const JOBS = {
  extract: "extract",
  checkPr: "check_pr",
  feedback: "feedback",
  syncInstallation: "sync_installation",
  rescanPrs: "rescan_prs",
  refreshMemory: "refresh_memory",
  ingestConnector: "ingest_connector",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export interface ExtractJob {
  installationId: number;
  fullName: string;
  prLimit?: number;
}

export interface CheckPrJob {
  installationId: number;
  fullName: string;
  prNumber: number;
  action: "opened" | "synchronize" | "manual";
}

export interface FeedbackJob {
  installationId: number;
  fullName: string;
  prNumber: number;
  action: "dismiss" | "confirm";
  byUser: string;
  reason?: string;
}

export interface SyncInstallationJob {
  installationId: number;
}

/**
 * Periodic fan-out jobs (scheduled via pg-boss cron). When `repoId` is omitted
 * the handler sweeps every active repo; pass one to scope a manual rescan.
 */
export interface RescanPrsJob {
  repoId?: string;
}

export interface RefreshMemoryJob {
  repoId?: string;
}

export interface IngestConnectorJob {
  repoId: string;
  connectorId: string;
}

export interface JobPayloads {
  [JOBS.extract]: ExtractJob;
  [JOBS.checkPr]: CheckPrJob;
  [JOBS.feedback]: FeedbackJob;
  [JOBS.syncInstallation]: SyncInstallationJob;
  [JOBS.rescanPrs]: RescanPrsJob;
  [JOBS.refreshMemory]: RefreshMemoryJob;
  [JOBS.ingestConnector]: IngestConnectorJob;
}

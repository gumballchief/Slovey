import { auditLogs, getDb, installations, repos } from "@company-brain/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export interface AuditEntry {
  orgId?: string | null;
  repoId?: string | null;
  actorUser?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
}

/**
 * Append an immutable audit record. Best-effort — a logging failure must never
 * break the underlying action. If only a repoId is given, the org is resolved
 * from it so org-scoped audit queries work.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = getDb();
    let orgId = entry.orgId ?? null;
    if (!orgId && entry.repoId) {
      const [r] = await db
        .select({ orgId: installations.orgId })
        .from(repos)
        .innerJoin(installations, eq(repos.installationId, installations.id))
        .where(eq(repos.id, entry.repoId))
        .limit(1);
      orgId = r?.orgId ?? null;
    }
    await db.insert(auditLogs).values({
      orgId,
      repoId: entry.repoId ?? null,
      actorUser: entry.actorUser ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? null) as Record<string, unknown> | null,
    });
  } catch (err) {
    logger.error("audit write failed", { err, action: entry.action });
  }
}

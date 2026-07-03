import { decisions, getDb, preflightOverrides } from "@company-brain/db";
import { and, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import type { DecisionViolation } from "./types";

export interface ActiveOverride {
  decisionId: string;
  grantedBy: string;
  reason: string;
  branch: string | null;
  expiresAt: Date | null;
}

/**
 * Active overrides for a repo, applicable to `branch` (branch-scoped overrides
 * only apply on their branch; branch=null applies everywhere).
 */
export async function getActiveOverrides(repoId: string, branch: string | null): Promise<Map<string, ActiveOverride>> {
  const db = getDb();
  const rows = await db
    .select({
      decisionId: preflightOverrides.decisionId,
      grantedBy: preflightOverrides.grantedBy,
      reason: preflightOverrides.reason,
      branch: preflightOverrides.branch,
      expiresAt: preflightOverrides.expiresAt,
    })
    .from(preflightOverrides)
    .where(
      and(
        eq(preflightOverrides.repoId, repoId),
        or(isNull(preflightOverrides.expiresAt), gt(preflightOverrides.expiresAt, sql`now()`)),
      ),
    )
    .catch(() => [] as ActiveOverride[]);
  const map = new Map<string, ActiveOverride>();
  for (const r of rows) {
    if (r.branch && branch && r.branch !== branch) continue;
    map.set(r.decisionId, r);
  }
  return map;
}

/**
 * Split violations into still-blocking vs overridden (pure — unit-tested).
 * Overridden ones become human-attributed warnings instead of blocks.
 */
export function applyOverrides(
  violations: DecisionViolation[],
  overrides: Map<string, ActiveOverride>,
): { blocking: DecisionViolation[]; warnings: string[] } {
  const blocking: DecisionViolation[] = [];
  const warnings: string[] = [];
  for (const v of violations) {
    const ov = overrides.get(v.decisionId);
    if (ov) {
      warnings.push(
        `Decision "${v.title}" would have blocked this change, but was OVERRIDDEN by ${ov.grantedBy}: ${ov.reason}` +
          (ov.expiresAt ? ` (expires ${ov.expiresAt.toISOString().slice(0, 10)})` : ""),
      );
    } else {
      blocking.push(v);
    }
  }
  return { blocking, warnings };
}

/**
 * Record a human override. `decisionIdOrPrefix` accepts the short id shown in
 * gate output. Time-boxed by default — overrides are the fast lane, not the
 * fix; the decision record itself should be updated for permanent changes.
 */
export async function createOverride(input: {
  repoId: string;
  decisionIdOrPrefix: string;
  reason: string;
  grantedBy: string;
  branch?: string | null;
  hours?: number;
}): Promise<{ id: string; decisionId: string; decision: string; expiresAt: Date | null }> {
  const db = getDb();
  const prefix = input.decisionIdOrPrefix.trim().toLowerCase();
  const matches = await db
    .select({ id: decisions.id, decision: decisions.decision })
    .from(decisions)
    .where(and(eq(decisions.repoId, input.repoId), like(sql`${decisions.id}::text`, `${prefix}%`)))
    .limit(2);
  if (matches.length === 0) throw new Error(`No decision found matching id "${input.decisionIdOrPrefix}"`);
  if (matches.length > 1) throw new Error(`Ambiguous decision id prefix "${input.decisionIdOrPrefix}" — use more characters`);
  const target = matches[0]!;

  const expiresAt = input.hours && input.hours > 0 ? new Date(Date.now() + input.hours * 3_600_000) : null;
  const [row] = await db
    .insert(preflightOverrides)
    .values({
      repoId: input.repoId,
      decisionId: target.id,
      branch: input.branch ?? null,
      reason: input.reason,
      grantedBy: input.grantedBy,
      expiresAt,
    })
    .returning({ id: preflightOverrides.id });
  return { id: row!.id, decisionId: target.id, decision: target.decision, expiresAt };
}

import { connectors, getDb } from "@company-brain/db";
import { eq } from "drizzle-orm";
import { getAI } from "../ai";
import { extractPrompt } from "../ai/prompts";
import type { ExtractedDecision } from "../ai/types";
import {
  getConnectorClient,
  isConnectorType,
  type ConnectorConfig,
  type ConnectorType,
} from "../connectors";
import { decryptSecret } from "../crypto";
import { logger } from "../logger";
import { upsertDecisions, type DecisionSource, type UpsertItem } from "./upsert-decisions";

const log = logger.child({ component: "ingest-connector" });
const MAX_DOCS = 40;
const MAX_DOC_CHARS = 8000;

/**
 * A later successful sync advances `lastSyncedAt`, so a stale failing run
 * must not overwrite that sync's status. Returns true when the connector
 * row has advanced since this run started (i.e. another run superseded it).
 */
export function shouldSkipStaleSyncError(
  startedLastSyncedAt: Date | null | undefined,
  currentLastSyncedAt: Date | null | undefined,
): boolean {
  return (startedLastSyncedAt?.getTime() ?? null) !== (currentLastSyncedAt?.getTime() ?? null);
}

export interface IngestResult {
  docs: number;
  inserted: number;
  updated: number;
}

/**
 * Pull documents from an external connector (Linear/Notion/Slack), run them
 * through the same extract LLM as PR history, and fold the results into the
 * repo's memory via the shared embed+dedup path. Decisions are cited by the
 * source document's URL, so they flow through the normal judge→cite pipeline.
 */
export async function runIngestConnector(params: {
  repoId: string;
  connectorId: string;
}): Promise<IngestResult> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectors)
    .where(eq(connectors.id, params.connectorId))
    .limit(1);
  if (!row) throw new Error(`connector not found: ${params.connectorId}`);
  if (row.repoId !== params.repoId) throw new Error(`connector not found: ${params.connectorId}`);
  const startedLastSyncedAt = row.lastSyncedAt ?? null;

  const type = row.type;
  if (!isConnectorType(type)) throw new Error(`unsupported connector type: ${type}`);

  await db
    .update(connectors)
    .set({ status: "syncing", lastError: null })
    .where(eq(connectors.id, row.id));

  try {
    const token = decryptSecret(row.encryptedToken);
    const client = getConnectorClient(type as ConnectorType, token);
    const docs = (await client.fetchDocs((row.config ?? {}) as ConnectorConfig)).slice(0, MAX_DOCS);

    const ai = getAI();
    const items: UpsertItem[] = [];
    let extractFailures = 0;
    for (const doc of docs) {
      if (!doc.content.trim()) continue;
      let res: ExtractedDecision[] | null;
      try {
        res = await ai.completeJSON<ExtractedDecision[]>(
          extractPrompt(`### ${type.toUpperCase()} — ${doc.title}\n${doc.content.slice(0, MAX_DOC_CHARS)}`),
          { tier: "cheap", maxTokens: 2000 },
        );
      } catch {
        extractFailures++;
        continue;
      }
      if (!Array.isArray(res)) {
        extractFailures++;
        continue;
      }
      for (const d of res) {
        if (!d || typeof d !== "object" || typeof d.decision !== "string" || !d.decision) continue;
        items.push({
          d: { ...d, evidence: [doc.url || doc.title] },
          source: type as DecisionSource,
        });
      }
    }

    // Recorded as the connector's error by the catch below.
    if (!items.length && extractFailures > 0) {
      throw new Error(`extraction failed for ${extractFailures} document(s)`);
    }

    const { inserted, updated } = items.length
      ? await upsertDecisions(params.repoId, items, `connector:${type}`)
      : { inserted: 0, updated: 0 };

    await db
      .update(connectors)
      .set({ status: "connected", lastSyncedAt: new Date(), lastError: null })
      .where(eq(connectors.id, row.id));
    log.info("connector ingested", { type, docs: docs.length, inserted, updated });
    return { docs: docs.length, inserted, updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A newer sync that finished while this one ran keeps its status.
    const [current] = await db
      .select({ lastSyncedAt: connectors.lastSyncedAt })
      .from(connectors)
      .where(eq(connectors.id, row.id))
      .limit(1);
    if (!current || !shouldSkipStaleSyncError(startedLastSyncedAt, current.lastSyncedAt)) {
      await db
        .update(connectors)
        .set({ status: "error", lastError: msg.slice(0, 500) })
        .where(eq(connectors.id, row.id));
    }
    log.warn("connector ingest failed", { type, err: msg });
    throw e;
  }
}

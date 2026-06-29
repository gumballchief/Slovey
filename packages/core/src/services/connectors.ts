import { connectors, getDb } from "@company-brain/db";
import { and, eq } from "drizzle-orm";
import { isConnectorType, type ConnectorConfig, type ConnectorType } from "../connectors";
import { encryptSecret } from "../crypto";

/** Safe connector view — never includes the token. */
export interface ConnectorStatus {
  id: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

function toStatus(row: typeof connectors.$inferSelect): ConnectorStatus {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

/** Connectors configured for a repo (no secrets). */
export async function listRepoConnectors(repoId: string): Promise<ConnectorStatus[]> {
  const db = getDb();
  const rows = await db.select().from(connectors).where(eq(connectors.repoId, repoId));
  return rows.map(toStatus);
}

/**
 * Save (or update) a connector: validate type, encrypt the token at rest, upsert
 * the row. Returns the safe status + the new row id (for enqueuing a sync).
 */
export async function saveConnector(
  repoId: string,
  type: string,
  token: string,
  config?: ConnectorConfig,
): Promise<ConnectorStatus> {
  if (!isConnectorType(type)) throw new Error(`unsupported connector type: ${type}`);
  if (!token?.trim()) throw new Error("token is required");
  const db = getDb();
  const [row] = await db
    .insert(connectors)
    .values({
      repoId,
      type: type as ConnectorType,
      encryptedToken: encryptSecret(token.trim()),
      config: config ?? {},
      status: "connected",
    })
    .onConflictDoUpdate({
      target: [connectors.repoId, connectors.type],
      set: { encryptedToken: encryptSecret(token.trim()), config: config ?? {}, status: "connected", lastError: null },
    })
    .returning();
  if (!row) throw new Error("failed to save connector");
  return toStatus(row);
}

/** Disconnect a connector (removes the stored token). */
export async function removeConnector(repoId: string, type: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(connectors)
    .where(and(eq(connectors.repoId, repoId), eq(connectors.type, type)))
    .returning({ id: connectors.id });
  return rows.length > 0;
}

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { apiTokens, getDb } from "@company-brain/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const PREFIX = "cb_";

/** SHA-256 hex of the plaintext token. The plaintext itself is never stored. */
function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export interface CreatedToken {
  id: string;
  /** The plaintext `cb_…` — shown to the user ONCE, never retrievable again. */
  token: string;
  tokenHint: string;
}

/**
 * Mint a repo-scoped personal token for the CLI / CI. Returns the plaintext
 * once; only its hash + a 4-char hint are persisted.
 */
export async function createApiToken(input: {
  userId: string;
  repoId: string;
  name?: string;
  expiresAt?: Date | null;
}): Promise<CreatedToken> {
  const db = getDb();
  const plain = PREFIX + randomBytes(24).toString("hex"); // cb_ + 48 hex chars
  const tokenHint = plain.slice(-4);
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: input.userId,
      repoId: input.repoId,
      name: input.name?.trim() || "cli",
      tokenHash: hashToken(plain),
      tokenHint,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: apiTokens.id });
  return { id: row!.id, token: plain, tokenHint };
}

export interface VerifiedToken {
  tokenId: string;
  userId: string;
  repoId: string;
}

/**
 * Validate a presented token: correct prefix, exists, not revoked, not expired.
 * Constant-time hash comparison. Updates last_used_at (best-effort). Returns the
 * associated user + repo, or null.
 */
export async function verifyApiToken(presented: string | null | undefined): Promise<VerifiedToken | null> {
  if (!presented || !presented.startsWith(PREFIX)) return null;
  const db = getDb();
  const hash = hashToken(presented.trim());
  const [row] = await db
    .select({
      id: apiTokens.id,
      userId: apiTokens.userId,
      repoId: apiTokens.repoId,
      tokenHash: apiTokens.tokenHash,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1)
    .catch(() => [] as never[]);
  if (!row) return null;
  // Defense in depth: constant-time compare even though we matched by hash.
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});
  return { tokenId: row.id, userId: row.userId, repoId: row.repoId };
}

export interface ApiTokenRow {
  id: string;
  name: string;
  tokenHint: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/** Active (non-revoked) tokens for a user, optionally scoped to a repo. No secrets. */
export async function listApiTokens(userId: string, repoId?: string): Promise<ApiTokenRow[]> {
  const db = getDb();
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenHint: apiTokens.tokenHint,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt),
        repoId ? eq(apiTokens.repoId, repoId) : sql`true`,
      ),
    );
}

/** Revoke a token the user owns. Returns true if a row was revoked. */
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  return rows.length > 0;
}

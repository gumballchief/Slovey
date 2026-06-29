import { getDb, users } from "@company-brain/db";

export interface UpsertUserInput {
  githubId: number;
  login: string;
  email?: string | null;
  avatarUrl?: string | null;
}

/** Upsert a user on login (keyed by GitHub id). */
export async function upsertUser(input: UpsertUserInput) {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({
      githubId: input.githubId,
      login: input.login,
      email: input.email ?? null,
      avatarUrl: input.avatarUrl ?? null,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: { login: input.login, email: input.email ?? null, avatarUrl: input.avatarUrl ?? null },
    })
    .returning();
  return row;
}

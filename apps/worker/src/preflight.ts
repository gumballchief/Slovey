import { loadEnv } from "@company-brain/config";
import { getAI, getEmbeddings } from "@company-brain/core";
import { closeDb, getSql } from "@company-brain/db";

/** Validate env + DB + pgvector + Gemini (chat & embeddings) before migrate/seed/eval. */
async function main() {
  let failures = 0;
  const fail = (m: string, e?: unknown) => {
    failures++;
    console.error(`✗ ${m}${e ? `: ${(e as Error).message}` : ""}`);
  };

  let env: ReturnType<typeof loadEnv>;
  try {
    env = loadEnv();
    console.log("✓ env parsed");
  } catch (e) {
    fail("env", e);
    process.exit(1);
  }

  // DB + pgvector
  try {
    const sql = getSql();
    await sql`select 1`;
    const ext = await sql`select 1 from pg_available_extensions where name = 'vector'`;
    if (ext.length > 0) console.log("✓ database reachable; pgvector available");
    else fail("pgvector not available (Supabase: enable the 'vector' extension; Neon: preinstalled)");
  } catch (e) {
    fail("database", e);
  }

  // Gemini chat
  try {
    const r = await getAI().completeJSON<{ ok: boolean }>(
      'Respond ONLY with JSON: {"ok":true}',
      { maxTokens: 20 },
    );
    if (r?.ok) console.log(`✓ Gemini chat (${env.GEMINI_MODEL})`);
    else fail(`Gemini chat returned an unexpected response (check GEMINI_MODEL=${env.GEMINI_MODEL})`);
  } catch (e) {
    fail("Gemini chat", e);
  }

  // Gemini embeddings + dimension match
  try {
    const v = await getEmbeddings().embedOne("connectivity check");
    if (v.length === env.EMBEDDING_DIMENSIONS) {
      console.log(`✓ Gemini embeddings (${v.length} dims)`);
    } else {
      fail(`embedding dim mismatch: got ${v.length}, expected ${env.EMBEDDING_DIMENSIONS}`);
    }
  } catch (e) {
    fail("Gemini embeddings", e);
  }

  await closeDb();
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll preflight checks passed. Safe to run: pnpm db:migrate && pnpm seed && pnpm eval");
}

main().catch(async (e) => {
  console.error("preflight crashed:", e);
  await closeDb();
  process.exit(1);
});

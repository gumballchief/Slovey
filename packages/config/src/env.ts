import { config as loadDotenv } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load .env from the monorepo root. Try the caller's cwd first (apps run from
// their own dir or the root), then the monorepo root located relative to THIS
// file — so entrypoints launched from a foreign cwd (e.g. the MCP server
// started inside another repo by Claude Code/Cursor) still find it.
// dotenv never overrides variables that are already set.
loadDotenv({ path: resolve(process.cwd(), ".env") });
loadDotenv({ path: resolve(process.cwd(), "../../.env") });
try {
  const here = dirname(fileURLToPath(import.meta.url)); // packages/config/src
  loadDotenv({ path: resolve(here, "../../../.env") }); // monorepo root
} catch {
  /* non-file URL (bundled) — cwd-based loading above already ran */
}

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Storage
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),

  // AI — provider is swappable; the chosen provider's key is checked at use.
  AI_PROVIDER: z.enum(["anthropic", "gemini", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_CHEAP: z.string().default("claude-haiku-4-5-20251001"),
  // Gemini (Google Generative Language API)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_MODEL_CHEAP: z.string().default("gemini-3.5-flash"),
  // OpenAI chat (used when AI_PROVIDER=openai; key reuses OPENAI_API_KEY below)
  OPENAI_CHAT_MODEL: z.string().default("gpt-4o"),
  OPENAI_CHAT_MODEL_CHEAP: z.string().default("gpt-4o-mini"),

  // Embeddings
  EMBEDDING_PROVIDER: z.enum(["voyage", "openai", "gemini"]).default("voyage"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default("voyage-3"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),

  // GitHub App
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_SLUG: z.string().default("company-brain"),

  // GitHub OAuth + Auth.js
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),

  // Token encryption at rest
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // App
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  // Comma-separated allowlist; the bot only comments on these repos.
  ALLOWLIST_REPOS: z
    .string()
    .default("gumballchief/pr-bot-test")
    .transform((s) =>
      s
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean),
    ),
});

type RawEnv = z.infer<typeof schema>;

let cached: (RawEnv & { githubAppPrivateKey: () => string }) | null = null;

/**
 * Parse + validate process.env once. Throws a readable error listing every
 * missing/invalid variable. Call from app entrypoints (web, worker).
 */
export function loadEnv() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const data = parsed.data;
  cached = {
    ...data,
    // Resolve the GitHub App private key from inline value or a PEM file path.
    githubAppPrivateKey() {
      if (data.GITHUB_APP_PRIVATE_KEY) {
        return data.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
      }
      if (data.GITHUB_APP_PRIVATE_KEY_PATH) {
        return readFileSync(resolve(data.GITHUB_APP_PRIVATE_KEY_PATH), "utf8");
      }
      throw new Error(
        "GitHub App private key not configured (set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH).",
      );
    },
  };
  return cached;
}

export type Env = ReturnType<typeof loadEnv>;
export { bool };

/**
 * Minimal accessor for just the database URL — so the db client and migrations
 * don't require AI/GitHub secrets to be present. dotenv has already loaded above.
 */
export function loadDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (check your .env).");
  }
  return url;
}

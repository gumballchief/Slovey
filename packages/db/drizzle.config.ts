import { defineConfig } from "drizzle-kit";

// `generate` works offline (diffs schema → SQL). `migrate`/`push`/`studio`
// use DATABASE_URL at runtime.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://brain:brain@localhost:5432/company_brain",
  },
  verbose: true,
  strict: true,
});

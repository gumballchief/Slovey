import { Pool } from "pg";

// Demo endpoint used to exercise Company Brain's memory: it intentionally uses a
// raw SQL string via node-postgres instead of Drizzle ORM, which conflicts with
// the repo's recorded decision "Database access goes through Drizzle ORM".
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(): Promise<Response> {
  // Raw SQL — bypasses Drizzle entirely.
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM decisions");
  return Response.json({ decisions: rows[0]?.n ?? 0 });
}

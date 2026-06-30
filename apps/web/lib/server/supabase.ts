import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Whether Supabase Auth is configured (URL + anon key present). */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Server-side Supabase client bound to the request cookies. Use in Server
 * Components / route handlers. `setAll` is wrapped because cookies are
 * read-only in Server Components (writes happen via middleware / route handlers).
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore; the session is
            // refreshed in the auth callback / middleware instead.
          }
        },
      },
    },
  );
}

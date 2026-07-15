import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy (Next 16's renamed Middleware). Refreshes the Supabase auth session on
 * server-rendered app requests.
 *
 * Server Components can't write cookies, so the rotated Supabase session cookie
 * can only be persisted here — without it the access token is never refreshed
 * and the next server-rendered page load sees an expired session and bounces the
 * user to /login (the "logged out on every reload" bug).
 *
 * Scoped (see `matcher`) to `/` and `/app/*` so it doesn't add a getUser()
 * round-trip to every static asset / public page — a lightweight session
 * refresh, not full session management.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // auth not configured (local dev) — nothing to refresh

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Must run immediately after createServerClient (Supabase requirement): this
  // validates + rotates the session and writes fresh cookies onto `response`.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/", "/app", "/app/:path*"],
};

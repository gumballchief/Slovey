import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { CANONICAL_HOSTS } from "@/lib/site";

/**
 * Proxy (Next 16's renamed Middleware). Two jobs:
 *
 * 1. Refresh the Supabase auth session on server-rendered app requests.
 *    Server Components can't write cookies, so the rotated Supabase session
 *    cookie can only be persisted here — without it the access token is never
 *    refreshed and the next server-rendered page load sees an expired session
 *    and bounces the user to /login (the "logged out on every reload" bug).
 *
 *    This is the expensive half (a getUser() round-trip), so it stays scoped to
 *    `/` and `/app/*` exactly as before — never on static assets or the other
 *    public marketing pages.
 *
 * 2. Mark non-canonical hosts as noindex. The app also answers on its Render
 *    hostname, which search engines otherwise treat as a second, competing copy
 *    of the entire site — splitting ranking authority and letting the wrong URL
 *    win. This half is free (a header, no I/O), so it runs site-wide.
 *    A header rather than a redirect, because platform health checks call the
 *    Render hostname directly and must keep getting a 200.
 */

function needsSessionRefresh(pathname: string): boolean {
  return pathname === "/" || pathname === "/app" || pathname.startsWith("/app/");
}

function isCanonicalHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return (
    (CANONICAL_HOSTS as readonly string[]).includes(host) ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (needsSessionRefresh(request.nextUrl.pathname)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // auth not configured (local dev) — nothing to refresh
    if (url && key) {
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

      // Must run immediately after createServerClient (Supabase requirement):
      // this validates + rotates the session and writes fresh cookies onto
      // `response`.
      await supabase.auth.getUser();
    }
  }

  // Applied last: the Supabase cookie handler above may have replaced
  // `response`, and the header has to land on whichever object is returned.
  if (!isCanonicalHost(request)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

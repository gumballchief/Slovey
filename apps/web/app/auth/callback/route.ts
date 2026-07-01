import { linkUserMemberships, upsertUser } from "@company-brain/core";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback — Supabase redirects here with `?code=`. We exchange it for a
 * session (sets the auth cookies), then upsert the user and populate their org
 * memberships from the GitHub provider token (available only here, right after
 * sign-in). Finally redirect into the app.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const user = data.session.user;
      const meta = (user.user_metadata ?? {}) as {
        user_name?: string;
        preferred_username?: string;
        provider_id?: string | number;
        avatar_url?: string;
      };
      const githubId = meta.provider_id ? Number(meta.provider_id) : undefined;
      const login = meta.user_name || meta.preferred_username;
      if (githubId && login) {
        try {
          await upsertUser({
            githubId,
            login,
            email: user.email ?? null,
            avatarUrl: meta.avatar_url ?? null,
          });
          // provider_token is the GitHub OAuth token — only present here.
          const token = data.session.provider_token;
          if (token) await linkUserMemberships(githubId, login, token);
        } catch (e) {
          console.error("[auth callback] post-signin setup failed:", e);
        }
      }
    }
  }

  // Redirect off the public base URL, not req.url: behind Render's proxy the
  // request address is the container's internal bind (0.0.0.0:$PORT), which the
  // browser can't reach. APP_BASE_URL is the canonical public origin; fall back
  // to the request origin for local dev. Guard `next` against open redirects.
  const base = process.env.APP_BASE_URL || url.origin;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return NextResponse.redirect(new URL(safeNext, base));
}

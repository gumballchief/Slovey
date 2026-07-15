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
      // Read the GitHub identity from `identities` — not just user_metadata — so
      // this works whether GitHub is the primary login OR was linked onto a
      // Google (etc.) account via "Connect GitHub". identity_data carries the
      // GitHub provider_id (numeric id) + user_name (handle).
      type GhIdentityData = { user_name?: string; preferred_username?: string; provider_id?: string | number; avatar_url?: string };
      const identities = (user.identities ?? []) as Array<{ provider: string; identity_data?: GhIdentityData }>;
      const ghData = (identities.find((i) => i.provider === "github")?.identity_data ?? {}) as GhIdentityData;
      const githubId = ghData.provider_id ? Number(ghData.provider_id) : meta.provider_id ? Number(meta.provider_id) : undefined;
      const login = ghData.user_name || ghData.preferred_username || meta.user_name || meta.preferred_username;
      if (githubId && login) {
        try {
          await upsertUser({
            githubId,
            login,
            email: user.email ?? null,
            avatarUrl: ghData.avatar_url ?? meta.avatar_url ?? null,
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

  // Redirect to the public origin the request actually arrived on. Behind
  // Render's proxy, req.url is the container's internal bind (0.0.0.0:$PORT) and
  // env-configured base URLs have proven unreliable across duplicate services;
  // the proxy sets x-forwarded-host/proto to the real public host, so trust
  // those. Fall back to APP_BASE_URL, then the request origin (local dev).
  // Guard `next` against open redirects.
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : process.env.APP_BASE_URL || url.origin;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return NextResponse.redirect(new URL(safeNext, base));
}

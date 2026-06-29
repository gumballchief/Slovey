import { linkUserMemberships, upsertUser } from "@company-brain/core";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

// Only register the provider when credentials exist, so the app boots without
// OAuth configured (dev mode uses the dev viewer in lib/server/auth.ts).
const providers = clientId && clientSecret ? [GitHub({ clientId, clientSecret })] : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET ?? "dev-only-insecure-secret",
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as { id?: number; login?: string };
        token.login = p.login;
        token.githubId = p.id;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { login?: string; githubId?: number };
      Object.assign(session.user, { login: t.login, githubId: t.githubId });
      return session;
    },
  },
  events: {
    async signIn({ profile, account }) {
      const p = profile as
        | { id?: number; login?: string; email?: string | null; avatar_url?: string | null }
        | undefined;
      if (p?.id && p.login) {
        try {
          await upsertUser({
            githubId: Number(p.id),
            login: p.login,
            email: p.email ?? null,
            avatarUrl: p.avatar_url ?? null,
          });
          // Populate org memberships from the installations the user can access.
          const token = account?.access_token;
          if (token) await linkUserMemberships(Number(p.id), p.login, token);
        } catch (err) {
          console.error("[auth] post-signin setup failed:", err);
        }
      }
    },
  },
});

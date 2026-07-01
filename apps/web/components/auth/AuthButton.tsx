"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";

/** Kick off Supabase GitHub OAuth. (GitHub OAuth is both sign-in and sign-up —
 *  first login provisions the account.) */
export function signInWithGitHub(next = "/app") {
  createSupabaseBrowser().auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
}

export function AuthButton({
  children,
  className,
  next = "/app",
}: {
  children: React.ReactNode;
  className?: string;
  next?: string;
}) {
  return (
    <button type="button" onClick={() => signInWithGitHub(next)} className={className}>
      {children}
    </button>
  );
}

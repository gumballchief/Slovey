"use client";

import { useState } from "react";
import { Brain, Loader2, Mail } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "github" | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/app` : undefined;

  function oauth(provider: "github" | "google") {
    setBusy(provider);
    setError(null);
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo } }).then(({ error }) => {
      if (error) {
        setError(error.message);
        setBusy(null);
      }
    });
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your account — then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/app");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-[var(--bg)] px-5 py-12 text-[var(--cb-text)]">
      {/* ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 blur-[60px]"
        style={{ background: "radial-gradient(50% 50% at 50% 30%, rgba(77,162,255,0.14), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <a href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
            <Brain size={17} className="text-[var(--on-primary)]" />
          </span>
          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-white">Company Brain</span>
        </a>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            {mode === "signin" ? "Welcome back to your engineering memory." : "Start capturing your team's decisions."}
          </p>

          {/* OAuth */}
          <div className="mt-6 space-y-2.5">
            <button
              onClick={() => oauth("github")}
              disabled={!!busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {busy === "github" ? <Loader2 size={16} className="animate-spin" /> : <GitHubIcon />}
              Continue with GitHub
            </button>
            <button
              onClick={() => oauth("google")}
              disabled={!!busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {busy === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>
          </div>

          {/* divider */}
          <div className="my-5 flex items-center gap-3 text-white/30">
            <span className="h-px flex-1 bg-white/10" />
            <span className="label-mono">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email */}
          <form onSubmit={submitEmail} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[var(--primary)]/60 focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ characters)"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[var(--primary)]/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!!busy}
              className="btn-mesh flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold disabled:opacity-60"
            >
              {busy === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={15} />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-[#FF6B8A]">{error}</p>}
          {notice && <p className="mt-3 text-sm text-[var(--primary)]">{notice}</p>}

          <p className="mt-5 text-center text-sm text-white/50">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="cursor-pointer font-medium text-[var(--primary)] hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/35">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

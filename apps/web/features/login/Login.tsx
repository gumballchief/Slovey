"use client";

import "@/ui/ui.css";
import "./login.css";
import { CaretDownIcon, EnvelopeSimpleIcon, GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createSupabaseBrowser, isAuthConfigured } from "@/lib/supabase-browser";
import { Button, Mark } from "@/ui/kit";

type Mode = "signin" | "signup";

/** Where to go after signing in: a "Get Team plan" click goes to checkout; otherwise ?next or the dashboard. */
function destination(params: URLSearchParams): string {
  if (params.get("plan") === "team") {
    return `/checkout?interval=${params.get("interval") === "monthly" ? "monthly" : "annual"}`;
  }
  const next = params.get("next");
  return next && /^\/(?![/\\])/.test(next) ? next : "/app";
}

export function Login() {
  const params = useSearchParams();
  const next = useMemo(() => destination(params), [params]);
  const team = params.get("plan") === "team";
  // Arrived from "Sign in with Slovey" in an agent (Claude, Cursor...).
  const connecting = next.startsWith("/oauth/authorize");
  const auth = isAuthConfigured();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [more, setMore] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "github" | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function redirectTo(): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function oauth(provider: "github" | "google") {
    setBusy(provider);
    setError(null);
    const { error: err } = await createSupabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (err) {
      setError(friendly(err.message));
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    setNotice(null);
    try {
      const sb = createSupabaseBrowser();
      if (mode === "signup") {
        const { error: err } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
        if (err) throw err;
        setNotice("Check your inbox for a link to confirm your email, then sign in.");
        setMode("signin");
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        window.location.assign(next);
        return;
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ui lg">
      <img className="lg-art" src="/art/closing.webp" alt="" aria-hidden />
      <div className="lg-shade" aria-hidden />
      <header className="lg-top">
        <Link href="/" className="lg-brand">
          <Mark size={30} />
          Slovey
        </Link>
      </header>

      <main className="lg-card">
        <div className="ui-eyebrow">
          {connecting ? "Connect your agent" : team ? "Team plan" : mode === "signup" ? "Create your account" : "Welcome back"}
        </div>
        <h1 className="ui-title lg-title">
          {connecting ? (
            <>
              Sign in to <span className="dim">connect your agent.</span>
            </>
          ) : team ? (
            <>
              Sign in to <span className="dim">start Team.</span>
            </>
          ) : mode === "signup" ? (
            <>
              Give your agents <span className="dim">a memory.</span>
            </>
          ) : (
            <>
              Sign in <span className="dim">to Slovey.</span>
            </>
          )}
        </h1>

        {!auth ? (
          <div className="lg-dev">
            <p className="ui-small">Sign-in isn&apos;t set up on this copy of Slovey. You can go straight in as the local owner.</p>
            <Link className="ui-btn ui-btn--light ui-btn--lg ui-btn--wide" href={next}>
              Open Slovey
            </Link>
          </div>
        ) : (
          <>
            <div className="lg-primary">
              <Button
                variant="light"
                size="lg"
                wide
                loading={busy === "github"}
                disabled={busy != null}
                icon={<GithubLogoIcon size={18} weight="fill" />}
                onClick={() => oauth("github")}
              >
                Continue with GitHub
              </Button>
              <p className="ui-small">Slovey learns from your repositories, so GitHub is the way in that connects them.</p>
            </div>

            <button type="button" className="lg-more" onClick={() => setMore((v) => !v)} aria-expanded={more}>
              {more ? "Fewer options" : "Other ways to sign in"}
              <CaretDownIcon size={13} style={{ transform: more ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
            </button>

            {more && (
              <div className="lg-others">
                <p className="ui-note" style={{ fontSize: 13 }}>
                  Google and email sign you in, but you&apos;ll still need GitHub to connect repositories.
                </p>
                <Button size="lg" wide loading={busy === "google"} disabled={busy != null} icon={<GoogleLogoIcon size={17} weight="bold" />} onClick={() => oauth("google")}>
                  Continue with Google
                </Button>
                <form className="lg-form" onSubmit={submit}>
                  <label className="ui-field">
                    <span>Email</span>
                    <input className="ui-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                  </label>
                  <label className="ui-field">
                    <span>Password</span>
                    <input
                      className="ui-input"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 8 characters" : ""}
                    />
                  </label>
                  <Button type="submit" size="lg" wide loading={busy === "email"} disabled={busy != null} icon={<EnvelopeSimpleIcon size={16} />}>
                    {mode === "signup" ? "Create account" : "Sign in with email"}
                  </Button>
                  <button type="button" className="lg-switch" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                    {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
                  </button>
                </form>
              </div>
            )}

            {error && (
              <div className="lg-msg lg-msg--err" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="lg-msg" role="status">
                {notice}
              </div>
            )}
          </>
        )}

        <p className="lg-fine">
          By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
        </p>
      </main>
    </div>
  );
}

function friendly(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return "That email and password don't match.";
  if (/email not confirmed/i.test(raw)) return "Confirm your email first: check your inbox for the link.";
  if (/already registered|already exists/i.test(raw)) return "There's already an account with that email. Sign in instead.";
  if (/rate limit|too many/i.test(raw)) return "Too many tries. Wait a minute and try again.";
  if (/password/i.test(raw) && /(short|least|weak)/i.test(raw)) return "Use a longer password, at least 8 characters.";
  if (/network|fetch/i.test(raw)) return "You look offline. Check your connection.";
  return raw || "Something went wrong. Try again.";
}

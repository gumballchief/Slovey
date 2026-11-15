"use client";

import "@/ui/ui.css";
import "@/features/login/login.css";
import "./oauth.css";
import { CheckIcon, LockKeyIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowser, isAuthConfigured } from "@/lib/supabase-browser";
import { Button, Mark } from "@/ui/kit";

type RepoOption = { id: string; name: string; decisions: number };

function Frame({ children }: { children: React.ReactNode }) {
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
      <main className="lg-card oa">{children}</main>
    </div>
  );
}

/** "Sign in with Slovey": an agent (Claude, Cursor...) asks to read one repository's decisions. */
export function Consent({
  request,
  clientName,
  returnHost,
  login,
  repos,
  canIssue,
}: {
  request: string;
  clientName: string;
  returnHost: string;
  login: string;
  repos: RepoOption[];
  /** False for an account with no GitHub identity: keys are tied to a GitHub user. */
  canIssue: boolean;
}) {
  const [repoId, setRepoId] = useState(repos[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "allow" | "deny">(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "allow" | "deny") {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request, repoId, decision }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || !body.redirect) throw new Error(body.error || "Something went wrong. Try again.");
      window.location.assign(body.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(null);
    }
  }

  async function switchAccount() {
    await createSupabaseBrowser().auth.signOut();
    window.location.reload();
  }

  return (
    <Frame>
      <div className="ui-eyebrow">Sign in with Slovey</div>
      <h1 className="ui-title lg-title">
        Connect {clientName} <span className="dim">to Slovey.</span>
      </h1>

      <p className="oa-who">
        Signed in as <strong>{login}</strong>.
        {isAuthConfigured() && (
          <>
            {" "}
            <button type="button" className="oa-link" onClick={switchAccount}>
              Not you?
            </button>
          </>
        )}
      </p>

      <ul className="oa-grants">
        <li>
          <CheckIcon size={15} weight="bold" /> Read the decisions of the repository you pick
        </li>
        <li>
          <CheckIcon size={15} weight="bold" /> Check its changes against them before committing
        </li>
        <li>
          <LockKeyIcon size={15} /> It can&apos;t change your code, decisions or settings
        </li>
      </ul>

      {!canIssue ? (
        <div className="lg-msg lg-msg--err" role="alert">
          Your account isn&apos;t linked to GitHub, and Slovey keys belong to a GitHub user. Link GitHub in{" "}
          <Link href="/app/profile">Profile</Link>, then start the connection again.
        </div>
      ) : repos.length === 0 ? (
        <div className="lg-msg" role="status">
          You have no repositories in Slovey yet. <Link href="/app">Connect one</Link>, then start the connection again.
        </div>
      ) : (
        <fieldset className="oa-repos">
          <legend className="ui-label">Repository</legend>
          {repos.map((r) => (
            <label key={r.id} className="oa-repo" data-on={repoId === r.id}>
              <input type="radio" name="repo" value={r.id} checked={repoId === r.id} onChange={() => setRepoId(r.id)} />
              <span className="oa-repo-name">{r.name}</span>
              <span className="ui-small">{r.decisions === 1 ? "1 decision" : `${r.decisions} decisions`}</span>
            </label>
          ))}
        </fieldset>
      )}

      {error && (
        <div className="lg-msg lg-msg--err" role="alert">
          {error}
        </div>
      )}

      <div className="oa-actions">
        <Button
          variant="light"
          size="lg"
          wide
          loading={busy === "allow"}
          disabled={!canIssue || repos.length === 0 || !repoId || busy != null}
          onClick={() => decide("allow")}
        >
          Allow
        </Button>
        <Button variant="ghost" size="lg" wide loading={busy === "deny"} disabled={busy != null} onClick={() => decide("deny")}>
          Cancel
        </Button>
      </div>

      <p className="lg-fine">
        You&apos;ll go back to {returnHost}. Remove access any time in Settings, under API keys.
      </p>
    </Frame>
  );
}

/** A broken or forged sign-in link: explained here, never bounced to an unverified address. */
export function ConsentProblem({ message }: { message: string }) {
  return (
    <Frame>
      <div className="ui-eyebrow">Sign in with Slovey</div>
      <h1 className="ui-title lg-title">
        This link <span className="dim">didn&apos;t work.</span>
      </h1>
      <div className="lg-msg lg-msg--err oa-problem" role="alert">
        <WarningCircleIcon size={18} />
        {message}
      </div>
      <p className="ui-small">Go back to the app you came from and start connecting Slovey again.</p>
    </Frame>
  );
}

"use client";

import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchTokens } from "@/lib/api-client";
import { useData } from "@/features/use-data";

/**
 * The first-run list on Today: what Slovey already did, and the steps that make it
 * useful (check what it learned, plug in an agent, turn on the commit gate). It
 * disappears once everything is done, or when hidden.
 */
export function GettingStarted({
  repoId,
  repoName,
  decisions,
  reviewCount,
  gateRuns,
}: {
  repoId: string;
  repoName: string;
  decisions: number;
  reviewCount: number;
  gateRuns: number;
}) {
  const tokens = useData(`${repoId}|tokens`, () => fetchTokens(repoId));
  const storeKey = `slovey.getting-started.hidden.${repoId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storeKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storeKey]);

  const agentConnected = (tokens.data ?? []).some((t) => t.lastUsedAt);
  const steps = [
    {
      done: decisions > 0,
      title: decisions > 0 ? `Slovey learned ${decisions} decisions from ${repoName}` : `Slovey is reading ${repoName}`,
      body:
        decisions > 0
          ? "From your merged and rejected pull requests and docs. It now checks every new pull request against them."
          : "It reads your pull requests and docs. Decisions show up in Memory as they're learned, usually within minutes.",
      action: { href: "/app/memory", label: "See them" },
    },
    {
      done: decisions > 0 && reviewCount === 0,
      title: "Check what it learned",
      body:
        reviewCount > 0
          ? `${reviewCount} decisions wait for you. Approve the ones your team stands behind and reject anything it got wrong.`
          : "Every learned decision has been reviewed.",
      action: { href: "/app/review", label: "Review" },
    },
    {
      done: agentConnected,
      title: "Connect your coding agent",
      body: "Claude Code, Cursor or Claude Desktop asks Slovey before writing code and checks its change before committing.",
      action: { href: "/app/connect", label: "Connect" },
    },
    {
      done: gateRuns > 0,
      title: "Turn on the commit gate",
      body: "Stops a commit that breaks a decision, on your machine and in CI, whoever wrote it.",
      action: { href: "/app/connect#gate", label: "Set up" },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || tokens.loading || doneCount === steps.length) return null;

  return (
    <section className="ui-card ui-card--raised gs" aria-label="Get Slovey working">
      <div className="gs-head">
        <div>
          <h2 className="ui-h3">Get Slovey working</h2>
          <span className="ui-small">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <button
          type="button"
          className="gs-hide"
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(storeKey, "1");
            } catch {
              /* private mode: hidden for this visit only */
            }
          }}
        >
          Hide
        </button>
      </div>
      <ol className="gs-steps">
        {steps.map((s) => (
          <li key={s.title} className="gs-step" data-done={s.done}>
            <span className="gs-mark" aria-hidden>
              {s.done ? <CheckCircleIcon size={20} weight="fill" /> : <CircleIcon size={20} />}
            </span>
            <div className="gs-text">
              <div className="gs-title">{s.title}</div>
              <p className="ui-small">{s.body}</p>
            </div>
            {!s.done && (
              <Link href={s.action.href} className="ui-btn ui-btn--sm">
                {s.action.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

"use client";

import { CheckIcon, ProhibitIcon } from "@phosphor-icons/react";
import { useState } from "react";

/* An interactive, sign-in-free example of a PR check. Sample data, labelled as such. */

type DemoPr = {
  number: number;
  title: string;
  author: string;
  verdict: "conflict" | "clear";
  decision: string | null;
  why: string | null;
  evidence: string[];
  file: string;
  diff: string[];
};

const PRS: DemoPr[] = [
  {
    number: 412,
    title: "Add render.yaml for Render.com deployment",
    author: "jsmith",
    verdict: "conflict",
    decision: "Platform-specific deploy config files are rejected: render.yaml, fly.toml, Procfile, vercel.json.",
    why: "We deploy through our internal CI/CD pipeline. Committing platform config confuses where the app deploys and risks accidental deploys.",
    evidence: ["PR #29501", "PR #29312"],
    file: "render.yaml",
    diff: ["services:", "  - type: web", "    name: api", "    env: node", "    buildCommand: npm run build", "    startCommand: npm start"],
  },
  {
    number: 410,
    title: "Add Paystack payment integration",
    author: "devrel-bot",
    verdict: "conflict",
    decision: "New third-party payment integrations need a vendor review. Payments go through the internal payments-service.",
    why: "Payments touch PCI scope, so any new provider changes our compliance surface.",
    evidence: ["PR #29296", "PR #10803"],
    file: "src/billing/paystack.ts",
    diff: [
      "import Paystack from 'paystack';",
      "",
      "export async function chargeCard(amount: number) {",
      "  const paystack = new Paystack(process.env.PAYSTACK_KEY);",
      "  return paystack.transaction.initialize({ amount });",
      "}",
    ],
  },
  {
    number: 411,
    title: "Refactor auth token refresh flow",
    author: "amara",
    verdict: "clear",
    decision: null,
    why: null,
    evidence: [],
    file: "src/auth/session.ts",
    diff: ["const token = await refreshToken(user.id, { rotate: true });"],
  },
];

export function Demo() {
  const [i, setI] = useState(0);
  const pr = PRS[i]!;
  const blocked = pr.verdict === "conflict";
  return (
    <div className="dm">
      <ol className="dm-list" aria-label="Sample pull requests">
        {PRS.map((p, k) => (
          <li key={p.number}>
            <button type="button" className="dm-pr" data-on={k === i} onClick={() => setI(k)}>
              <span className="ui-row-icon" data-tone={p.verdict === "conflict" ? "red" : "green"}>
                {p.verdict === "conflict" ? <ProhibitIcon size={16} weight="bold" /> : <CheckIcon size={16} weight="bold" />}
              </span>
              <span>
                <strong>{p.title}</strong>
                <span className="ui-small">
                  #{p.number} by @{p.author}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="dm-view">
        <div className="ui-diff">
          <div className="ui-diff-file">{pr.file}</div>
          {pr.diff.map((l, k) => (
            <div key={k} className="ui-diff-line" data-kind="add">
              + {l}
            </div>
          ))}
        </div>

        <div className="dm-verdict" data-blocked={blocked}>
          <div className="dm-verdict-head">
            <span className={blocked ? "ui-badge ui-badge--red" : "ui-badge ui-badge--green"}>
              <span className="ui-dot" /> {blocked ? "Blocked" : "Clear"}
            </span>
            <span className="ui-small">Slovey on PR #{pr.number}</span>
          </div>
          {blocked ? (
            <>
              <div className="ui-label">The decision it breaks</div>
              <div className="ui-title ui-title--sm">{pr.decision}</div>
              <p className="ui-body">{pr.why}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="ui-small">Learned from</span>
                {pr.evidence.map((e) => (
                  <span key={e} className="ui-ref">
                    {e}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="ui-body">No decision covers this change in a way it breaks. It goes through without a comment.</p>
          )}
        </div>
        <p className="ui-small">Sample pull requests. Connect a repository to see Slovey on your own.</p>
      </div>
    </div>
  );
}

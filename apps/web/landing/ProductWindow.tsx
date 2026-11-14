"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Terminal,
  GitPullRequest,
  ChatCircleText,
  XCircle,
  CheckCircle,
  ArrowBendDownRight,
  House,
  Brain,
  ShieldCheck,
  Plugs,
  MagnifyingGlass,
} from "@phosphor-icons/react";

export const TABS = [
  { id: "preflight", label: "Preflight", Icon: Terminal },
  { id: "pr", label: "Pull request", Icon: GitPullRequest },
  { id: "ask", label: "Ask", Icon: ChatCircleText },
] as const;
export type TabId = (typeof TABS)[number]["id"];

const EASE = [0.16, 1, 0.3, 1] as const;

function Preflight() {
  return (
    <div className="pw-term">
      <div className="pw-line pw-dim">
        <span className="pw-path">~/billing-service</span> <span className="pw-branch">agent/retry-charges</span> <span className="pw-prompt">$</span>{" "}
        <span className="pw-cmd">slovey preflight</span>
      </div>
      <div className="pw-line pw-dim">Checking 6 changed files against 214 decisions</div>
      <div className="pw-block pw-block--bad">
        <div className="pw-line pw-head">
          <XCircle weight="fill" className="pw-ico pw-ico--bad" aria-hidden />
          <span className="pw-tag pw-tag--bad">Blocked</span>
          <span>src/charges/retry.ts:22</span>
        </div>
        <div className="pw-line pw-code">
          <span className="pw-del">- maxRetries: 3</span>
          <span className="pw-add">+ maxRetries: 8</span>
        </div>
        <div className="pw-line">
          Breaks decision <span className="pw-quote">&ldquo;Charge retries stay capped at 3&rdquo;</span>
        </div>
        <div className="pw-line pw-dim">
          <ArrowBendDownRight className="pw-ico" aria-hidden /> From PR #418, after incident INC-2207 double-charged customers
        </div>
        <div className="pw-line pw-fix">Keep the cap at 3 and add backoff, or reopen the decision on #418.</div>
      </div>
      <div className="pw-line pw-ok">
        <CheckCircle weight="fill" className="pw-ico pw-ico--ok" aria-hidden /> 5 files clear <span className="pw-dim">&nbsp; 1 blocked, nothing committed</span>
      </div>
    </div>
  );
}

function PullRequest() {
  return (
    <div className="pw-pr">
      <div className="pw-pr-head">
        <GitPullRequest className="pw-ico pw-ico--open" weight="bold" aria-hidden />
        <div>
          <div className="pw-pr-title">
            Retry failed charges more aggressively <span className="pw-dim">#512</span>
          </div>
          <div className="pw-pr-meta pw-dim">Opened by Claude Code on behalf of mira-oduya</div>
        </div>
      </div>
      <div className="pw-comment">
        <div className="pw-comment-head">
          <img src="/brand/mark.png" alt="" className="pw-avatar" />
          <b>slovey</b> <span className="pw-dim">reviewed just now</span>
        </div>
        <p>
          This raises charge retries from 3 to 8. Your team capped them at 3 in <span className="pw-ref">#418</span> after{" "}
          <span className="pw-ref pw-ref--bad">INC-2207</span>, where repeated retries charged the same cards twice.
        </p>
        <p className="pw-dim">Suggested: keep 3 retries and add exponential backoff between them.</p>
        <div className="pw-actions">
          <span className="pw-btn">Apply suggestion</span>
          <span className="pw-btn pw-btn--ghost">Reopen decision</span>
        </div>
      </div>
      <div className="pw-check">
        <XCircle weight="fill" className="pw-ico pw-ico--bad" aria-hidden /> <b>Slovey decisions</b>
        <span className="pw-dim">1 conflict with a settled decision</span>
      </div>
    </div>
  );
}

const ANSWER =
  "Because of INC-2207. In March, retries on the charge endpoint ran up to 8 times during a processor timeout, and some cards were charged twice. PR #418 capped retries at 3 and moved the rest to a backoff queue. Raise the cap only together with idempotency keys on the processor call.";

function Ask({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? ANSWER.length : 0);
  useEffect(() => {
    if (!active || reduce) return;
    setN(0);
    const id = window.setInterval(() => setN((v) => (v >= ANSWER.length ? v : v + 3)), 22);
    return () => window.clearInterval(id);
  }, [active, reduce]);
  const done = n >= ANSWER.length;
  return (
    <div className="pw-ask">
      <div className="pw-q">Why do charge retries stop at 3?</div>
      <div className="pw-a">
        <img src="/brand/mark.png" alt="" className="pw-avatar" />
        <div>
          <p>
            {ANSWER.slice(0, n)}
            {!done && <span className="pw-caret" aria-hidden />}
          </p>
          <div className={`pw-cites ${done ? "is-in" : ""}`}>
            <span className="pw-ref">PR #418 Cap charge retries</span>
            <span className="pw-ref pw-ref--bad">INC-2207 postmortem</span>
            <span className="pw-ref">Decision: retries stay at 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { label: "Overview", Icon: House },
  { label: "Memory", Icon: Brain },
  { label: "Preflight", Icon: ShieldCheck },
  { label: "Connections", Icon: Plugs },
];

/** A light Slovey app window. Controlled by `tab` when the page scroll drives it. */
export function ProductWindow({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="pw">
      <aside className="pw-side" aria-hidden>
        <div className="pw-side-brand">
          <img src="/brand/mark.png" alt="" className="pw-avatar" />
          <span>billing-service</span>
        </div>
        <div className="pw-search">
          <MagnifyingGlass /> Search memory
        </div>
        {NAV.map(({ label, Icon }) => (
          <div key={label} className={`pw-nav ${label === "Preflight" ? "is-on" : ""}`}>
            <Icon /> {label}
          </div>
        ))}
        <div className="pw-side-foot">
          <span className="pw-side-num">214</span> decisions learned
        </div>
      </aside>
      <div className="pw-main">
        <div className="pw-bar">
          <div className="pw-tabs" role="tablist" aria-label="Where Slovey shows up">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`pw-tab ${tab === id ? "is-on" : ""}`} onClick={() => onTab(id)}>
                <Icon className="pw-ico" aria-hidden />
                {label}
                {tab === id && <motion.span layoutId="pw-underline" className="pw-underline" transition={{ duration: 0.35, ease: EASE }} />}
              </button>
            ))}
          </div>
          <span className="pw-crumb">Projects / Payments / billing-service</span>
        </div>
        <div className="pw-body">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              role="tabpanel"
              initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.36, ease: EASE }}
            >
              {tab === "preflight" && <Preflight />}
              {tab === "pr" && <PullRequest />}
              {tab === "ask" && <Ask active={tab === "ask"} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

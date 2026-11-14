"use client";

import "./ask.css";
import { ArrowUpIcon, GitPullRequestIcon, GraphIcon, LightningIcon, ListChecksIcon, WarningIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  askBrain,
  askBrainStream,
  canIBrain,
  planBrain,
  type AskAnswer,
  type BrainCitation,
  type CanIAnswer,
  type PlanAnswer,
} from "@/lib/api-client";
import { EvidenceList, prUrl } from "@/features/refs";
import { NeedsRepo } from "@/features/shell/Page";
import { repoShortName, useRepo } from "@/features/shell/RepoProvider";
import { Badge, Mark, Ref, Segmented, errorMessage } from "@/ui/kit";

type Mode = "ask" | "can" | "plan";
type Turn = {
  id: number;
  mode: Mode;
  q: string;
  text: string;
  done: boolean;
  ask?: AskAnswer;
  can?: CanIAnswer;
  plan?: PlanAnswer;
  error?: string;
};

const PLACEHOLDER: Record<Mode, string> = {
  ask: "Ask about any decision, file or incident",
  can: "Describe a change: can I add Redis caching to the auth service?",
  plan: "Describe what you want to build and Slovey plans it within your decisions",
};

const STARTERS: Array<{ mode: Mode; q: string }> = [
  { mode: "ask", q: "What are the most important decisions in this repo?" },
  { mode: "ask", q: "What has the team tried before and rejected?" },
  { mode: "can", q: "Can I add a new dependency for date handling?" },
  { mode: "plan", q: "Add rate limiting to the public API" },
];

export function Ask() {
  return <NeedsRepo>{(repoId) => <AskFor repoId={repoId} />}</NeedsRepo>;
}

function AskFor({ repoId }: { repoId: string }) {
  const { repo } = useRepo();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  // Start a new thread when the user switches repo: answers belong to one repo.
  const lastRepo = useRef(repoId);
  useEffect(() => {
    if (lastRepo.current !== repoId) {
      lastRepo.current = repoId;
      setTurns([]);
    }
  }, [repoId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(q: string, m: Mode = mode) {
    const question = q.trim();
    if (!question || busy) return;
    const id = ++idRef.current;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { id, mode: m, q: question, text: "", done: false }]);
    const patch = (p: Partial<Turn>) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));
    try {
      if (m === "ask") {
        let streamed = "";
        let answer: AskAnswer;
        try {
          answer = await askBrainStream(repoId, question, (tok) => {
            streamed += tok;
            patch({ text: streamed });
          });
        } catch {
          // The streaming endpoint failed: fall back to the plain one.
          answer = await askBrain(repoId, question);
        }
        patch({ ask: answer, text: answer.answer || streamed, done: true });
      } else if (m === "can") {
        const can = await canIBrain(repoId, question);
        patch({ can, text: can.rationale, done: true });
      } else {
        const plan = await planBrain(repoId, question);
        patch({ plan, text: plan.summary, done: true });
      }
    } catch (e) {
      patch({ error: errorMessage(e), done: true });
    } finally {
      setBusy(false);
    }
  }

  // /app/ask?q=... (from search or "Ask about it") asks once on arrival.
  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      void send(q, "ask");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <main className="ask">
      <div className="ask-thread">
        {turns.length === 0 && (
          <div className="ask-hello">
            <Mark size={40} />
            <h1 className="ui-title ui-title--md">Ask your codebase&apos;s memory</h1>
            <p className="ui-body ui-muted">
              Answers come from the decisions Slovey learned in {repo ? repoShortName(repo.name) : "this repository"}, with
              the pull requests behind them.
            </p>
            <div className="ask-starters">
              {STARTERS.map((s) => (
                <button
                  key={s.q}
                  type="button"
                  className="ui-chip"
                  onClick={() => {
                    setMode(s.mode);
                    void send(s.q, s.mode);
                  }}
                >
                  {s.q}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t) => (
          <Fragment key={t.id}>
            <div className="ask-q">{t.q}</div>
            <div className="ask-a">
              <Mark size={28} />
              <div className="ask-a-body">
                {t.mode !== "ask" && (
                  <div className="ui-label" style={{ marginBottom: 8 }}>
                    {t.mode === "can" ? "Can I…?" : "Plan"}
                  </div>
                )}
                {t.error ? (
                  <div className="ask-error">
                    <WarningIcon size={16} /> {t.error}
                  </div>
                ) : !t.text && !t.done ? (
                  <div className="ask-typing" aria-label="Thinking">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : (
                  <>
                    {t.can && <Verdict v={t.can.verdict} />}
                    {t.plan && <Verdict v={t.plan.verdict} risk={t.plan.risk} />}
                    <Prose text={t.text} repoName={repo?.name} />
                    {!t.done && <span className="ask-caret" />}
                    {t.ask && <AskExtras a={t.ask} repoName={repo?.name} onFollow={(q, m) => send(q, m)} />}
                    {t.can && <CanExtras c={t.can} repoName={repo?.name} />}
                    {t.plan && <PlanExtras p={t.plan} repoName={repo?.name} />}
                  </>
                )}
              </div>
            </div>
          </Fragment>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="ask-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={PLACEHOLDER[mode]}
          rows={1}
          aria-label="Your question"
        />
        <div className="ask-row">
          <span className="ask-chip">
            <GraphIcon size={14} /> {repo ? repoShortName(repo.name) : "repository"}
          </span>
          <Segmented<Mode>
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "ask", label: "Ask" },
              { value: "can", label: "Can I…?" },
              { value: "plan", label: "Plan" },
            ]}
          />
          <button type="submit" className="ask-send" disabled={!input.trim() || busy} aria-label="Send">
            <ArrowUpIcon size={17} weight="bold" />
          </button>
        </div>
      </form>
    </main>
  );
}

/** Plain text with `code`, #PR and INC-123 turned into chips. Never renders HTML. */
function Prose({ text, repoName }: { text: string; repoName?: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="ask-prose">
      {paras.map((p, i) => (
        <p key={i}>{inline(p, repoName)}</p>
      ))}
    </div>
  );
}

function inline(s: string, repoName?: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|(#\d+)|\b((?:INC|SEV)-\d+)\b|\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<code key={k++} className="ui-code-inline">{m[1]}</code>);
    else if (m[2]) out.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) out.push(<Ref key={k++} href={prUrl(repoName, m[3].slice(1))}>{m[3]}</Ref>);
    else if (m[4]) out.push(<Ref key={k++} red>{m[4]}</Ref>);
    else if (m[5]) out.push(<sup key={k++} className="ask-cite" title={`Source ${m[5]}`}>{m[5]}</sup>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function Verdict({ v, risk }: { v: "allowed" | "disallowed" | "unclear"; risk?: "low" | "medium" | "high" }) {
  return (
    <div className="ask-verdict">
      {v === "allowed" ? (
        <Badge tone="green" dot>Fits your decisions</Badge>
      ) : v === "disallowed" ? (
        <Badge tone="red" dot>Breaks a decision</Badge>
      ) : (
        <Badge tone="amber" dot>No clear answer</Badge>
      )}
      {risk && <Badge tone={risk === "high" ? "red" : risk === "medium" ? "amber" : undefined}>{risk} risk</Badge>}
    </div>
  );
}

function Sources({ cites, repoName }: { cites: BrainCitation[]; repoName?: string }) {
  if (!cites.length) return null;
  return (
    <div className="ask-sources">
      {cites.slice(0, 6).map((c) => (
        <Link key={c.decisionId} href={`/app/memory?d=${c.decisionId}`} className="ask-source">
          <span className="ask-source-k">
            <GitPullRequestIcon size={13} /> Decision
          </span>
          <span className="ask-source-t">{c.title || c.decision}</span>
          {c.evidence.length > 0 && <EvidenceList evidence={c.evidence} repoName={repoName} max={2} plain />}
        </Link>
      ))}
    </div>
  );
}

function AskExtras({
  a,
  repoName,
  onFollow,
}: {
  a: AskAnswer;
  repoName?: string;
  onFollow: (q: string, m: Mode) => void;
}) {
  const top = a.citations[0];
  return (
    <>
      {a.confidence === "none" && (
        <p className="ui-small" style={{ marginTop: 6 }}>
          No learned decision covers this yet. If your team has a rule for it, add it in Memory.
        </p>
      )}
      <Sources cites={a.citations} repoName={repoName} />
      {top && (
        <div className="ask-follow">
          <button type="button" className="ui-chip" onClick={() => onFollow(`Can I change this: ${top.decision}`, "can")}>
            <LightningIcon size={13} /> Can I change it?
          </button>
          <button type="button" className="ui-chip" onClick={() => onFollow(`What was tried before around: ${top.decision}`, "ask")}>
            What was tried before?
          </button>
          <Link className="ui-chip" href={`/app/memory?d=${top.decisionId}`}>
            Open in Memory
          </Link>
        </div>
      )}
    </>
  );
}

function CanExtras({ c, repoName }: { c: CanIAnswer; repoName?: string }) {
  return (
    <>
      {c.rejectedPrecedent.length > 0 && (
        <div className="ask-block">
          <div className="ui-label">Tried before and turned down</div>
          {c.rejectedPrecedent.map((r, i) => (
            <div key={i} className="ask-reject">
              <strong>{r.decision}</strong>
              {r.rejectionReason && <span>{r.rejectionReason}</span>}
              {r.alternatives.length > 0 && <span>Instead: {r.alternatives.join("; ")}</span>}
            </div>
          ))}
        </div>
      )}
      <Sources cites={c.citations} repoName={repoName} />
    </>
  );
}

function PlanExtras({ p, repoName }: { p: PlanAnswer; repoName?: string }) {
  return (
    <>
      {p.steps.length > 0 && (
        <ol className="ask-steps">
          {p.steps.map((s, i) => (
            <li key={i}>
              <span className="n">{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {p.constraints.length > 0 && (
        <div className="ask-block">
          <div className="ui-label">
            <ListChecksIcon size={12} /> Decisions this plan must respect
          </div>
          {p.constraints.map((c, i) => (
            <div key={i} className="ask-reject">
              <strong>{c.decision}</strong>
              <span>{c.why}</span>
            </div>
          ))}
        </div>
      )}
      {p.conflicts.length > 0 && (
        <div className="ask-block">
          <div className="ui-label">Conflicts</div>
          {p.conflicts.map((c, i) => (
            <div key={i} className="ask-error">
              <WarningIcon size={15} /> {c}
            </div>
          ))}
        </div>
      )}
      <Sources cites={p.citations} repoName={repoName} />
    </>
  );
}

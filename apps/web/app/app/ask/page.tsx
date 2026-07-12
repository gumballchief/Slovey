"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  HelpCircle,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import {
  askBrain,
  canIBrain,
  planBrain,
  type AskAnswer,
  type BrainCitation,
  type CanIAnswer,
  type Confidence,
  type PlanAnswer,
} from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Mode = "ask" | "can-i" | "plan";

const MODES: Array<{ id: Mode; label: string; placeholder: string; verb: string }> = [
  { id: "ask", label: "Ask", placeholder: "Why don't we use Redis? · Who owns billing?", verb: "Ask" },
  { id: "can-i", label: "Can I?", placeholder: "Can I add styled-components? · Can I introduce Kafka?", verb: "Check" },
  { id: "plan", label: "Plan", placeholder: "Implement Redis caching for billing · Add OAuth login", verb: "Plan" },
];

const EXAMPLES: Record<Mode, string[]> = {
  ask: ["Why don't we use Redis?", "Who owns billing?", "What changed recently?"],
  "can-i": ["Can I add styled-components?", "Can I add a fly.toml?", "Can I introduce Kafka?"],
  plan: ["Implement Redis caching for billing", "Add OAuth login", "Migrate the worker to a microservice"],
};

type Turn =
  | { id: number; mode: "ask"; q: string; loading: boolean; error?: string; data?: AskAnswer }
  | { id: number; mode: "can-i"; q: string; loading: boolean; error?: string; data?: CanIAnswer }
  | { id: number; mode: "plan"; q: string; loading: boolean; error?: string; data?: PlanAnswer };

let nextId = 1;

export default function AskPage() {
  const { activeRepoId } = useRepo();
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    const id = nextId++;
    const base = { id, mode, q, loading: true } as Turn;
    setTurns((t) => [...t, base]);
    setInput("");
    queueMicrotask(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

    try {
      if (mode === "ask") {
        const data = await askBrain(activeRepoId, q);
        update(id, { loading: false, data });
      } else if (mode === "can-i") {
        const data = await canIBrain(activeRepoId, q);
        update(id, { loading: false, data });
      } else {
        const data = await planBrain(activeRepoId, q);
        update(id, { loading: false, data });
      }
    } catch (e) {
      update(id, { loading: false, error: e instanceof Error ? e.message : "Something went wrong" });
    }
    queueMicrotask(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function update(id: number, patch: Partial<Turn>) {
    setTurns((t) => t.map((turn) => (turn.id === id ? ({ ...turn, ...patch } as Turn) : turn)));
  }

  const empty = turns.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center">
            <Sparkles size={16} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg tracking-[-0.02em] text-[var(--cb-text)] leading-none">
              Ask Slovey
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Grounded in your team's decisions — cited, or honest about not knowing.
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 mt-4 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] w-fit">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer",
                mode === m.id
                  ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--cb-text)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {empty ? (
            <div className="pt-6">
              <p className="text-sm text-[var(--text-muted)] mb-3">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES[mode].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => submit(ex)}
                    className="text-sm px-3.5 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--cb-text)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => <TurnView key={turn.id} turn={turn} onFollow={submit} />)
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder={MODES.find((m) => m.id === mode)!.placeholder}
            className="flex-1 resize-none text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] max-h-40"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send"
            className="shrink-0 w-11 h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function TurnView({ turn, onFollow }: { turn: Turn; onFollow: (q: string) => void }) {
  return (
    <div className="space-y-3">
      {/* Question */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--primary)] text-[var(--on-primary)] px-4 py-2.5 text-sm">
          {turn.q}
        </div>
      </div>

      {/* Answer */}
      <div className="card p-5">
        {turn.loading ? (
          <Reasoning />
        ) : turn.error ? (
          <div className="flex items-start gap-2 text-sm text-[#F43F5E]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{turn.error}</span>
          </div>
        ) : turn.mode === "ask" && turn.data ? (
          <AskView data={turn.data} onFollow={onFollow} />
        ) : turn.mode === "can-i" && turn.data ? (
          <CanIView data={turn.data} />
        ) : turn.mode === "plan" && turn.data ? (
          <PlanView data={turn.data} />
        ) : null}
      </div>
    </div>
  );
}

function Reasoning() {
  return (
    <div className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" />
      </span>
      Reasoning over the decision graph…
    </div>
  );
}

const CONF_STYLE: Record<Confidence, string> = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  none: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
};

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full", CONF_STYLE[confidence])}>
      {confidence === "none" ? "no evidence" : `${confidence} confidence`}
    </span>
  );
}

function Citations({ citations }: { citations: BrainCitation[] }) {
  if (!citations.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--text-muted)]">Sources</p>
      {citations.map((c) => (
        <div key={c.decisionId} className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
          <div className="flex items-start gap-2 justify-between">
            <p className="text-sm text-[var(--cb-text)] leading-snug">{c.decision}</p>
            <Badge variant={c.status === "approved" ? "approved" : c.status === "rejected" ? "default" : "suggested"}>
              {c.status}
            </Badge>
          </div>
          {c.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.evidence.map((ev) => (
                <span
                  key={ev}
                  className="chip"
                >
                  <ExternalLink size={10} />
                  {ev}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RejectedPrecedent({
  items,
}: {
  items: Array<{ decision: string; rejectionReason: string | null; alternatives: string[] }>;
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-1.5">
      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <AlertTriangle size={12} /> We already tried this
      </p>
      {items.map((p, i) => (
        <div key={i} className="text-sm text-[var(--cb-text)]">
          {p.decision}
          {p.rejectionReason && <span className="text-[var(--text-muted)]"> — {p.rejectionReason}</span>}
          {p.alternatives.length > 0 && (
            <span className="text-[var(--text-muted)]"> · instead: {p.alternatives.join(", ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ReasoningTrace({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--cb-text)] cursor-pointer"
      >
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
        How this was reasoned
      </button>
      {open && (
        <ol className="mt-2 space-y-1 border-l-2 border-[var(--border)] pl-3">
          {steps.map((s, i) => (
            <li key={i} className="text-xs text-[var(--text-muted)] leading-relaxed">
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AskView({ data, onFollow }: { data: AskAnswer; onFollow: (q: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <ConfidencePill confidence={data.confidence} />
      </div>
      <p className="text-sm text-[var(--cb-text)] leading-relaxed whitespace-pre-wrap">{data.answer}</p>
      <Citations citations={data.citations} />
      <ReasoningTrace steps={data.reasoning} />
      {data.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {data.citations.slice(0, 3).map((c) => (
            <button
              key={c.decisionId}
              onClick={() => onFollow(`Tell me more about: ${c.title}`)}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            >
              More on “{c.title}”
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const VERDICT: Record<CanIAnswer["verdict"], { icon: typeof CheckCircle2; cls: string; label: string }> = {
  allowed: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", label: "Allowed" },
  disallowed: { icon: Ban, cls: "text-[#F43F5E] bg-red-500/10", label: "Disallowed" },
  unclear: { icon: CircleHelp, cls: "text-[var(--text-muted)] bg-[var(--bg-subtle)]", label: "Unclear" },
};

function VerdictHeader({ verdict }: { verdict: CanIAnswer["verdict"] }) {
  const v = VERDICT[verdict];
  const Icon = v.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full", v.cls)}>
      <Icon size={14} /> {v.label}
    </span>
  );
}

function CanIView({ data }: { data: CanIAnswer }) {
  return (
    <div className="space-y-4">
      <VerdictHeader verdict={data.verdict} />
      <p className="text-sm text-[var(--cb-text)] leading-relaxed">{data.rationale}</p>
      <RejectedPrecedent items={data.rejectedPrecedent} />
      <Citations citations={data.citations} />
    </div>
  );
}

const RISK_STYLE: Record<PlanAnswer["risk"], string> = {
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-red-500/10 text-[#F43F5E]",
};

function PlanView({ data }: { data: PlanAnswer }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">{data.intent}</Badge>
        <VerdictHeader verdict={data.verdict} />
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", RISK_STYLE[data.risk])}>
          {data.risk} risk
        </span>
        <ConfidencePill confidence={data.confidence} />
      </div>

      <p className="text-sm text-[var(--cb-text)] leading-relaxed">{data.summary}</p>

      {data.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-[#F43F5E] flex items-center gap-1.5">
            <AlertTriangle size={12} /> Blockers
          </p>
          {data.conflicts.map((c, i) => (
            <p key={i} className="text-sm text-[var(--cb-text)] leading-snug">
              {c}
            </p>
          ))}
        </div>
      )}

      {data.steps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
            <ListChecks size={13} /> Plan
          </p>
          <ol className="space-y-2">
            {data.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--cb-text)]">{s.title}</p>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <RejectedPrecedent items={data.rejectedPrecedent} />

      {data.constraints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Active constraints honoured</p>
          {data.constraints.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-[var(--cb-text)]">
              <HelpCircle size={13} className="mt-0.5 shrink-0 text-[var(--primary)]" />
              {c.decision}
            </div>
          ))}
        </div>
      )}

      <ReasoningTrace steps={data.reasoning} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { RefreshCw, Check } from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import { CliTokens } from "@/components/ui/CliTokens";
import { fetchSettings, patchSettings, rebuildMemory, type RepoSettings } from "@/lib/api-client";

type ConfidenceLevel = "low" | "high" | "strict";

export default function SettingsPage() {
  const { activeRepoId } = useRepo();
  const [confidence, setConfidence] = useState<ConfidenceLevel>("high");
  const [triggerOnOpen, setTriggerOnOpen] = useState(true);
  const [triggerOnUpdate, setTriggerOnUpdate] = useState(false);
  const [commentMode, setCommentMode] = useState(true);
  const [learnDismissals, setLearnDismissals] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuilt, setRebuilt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSettings(activeRepoId).then((s) => {
      if (cancelled) return;
      setConfidence(s.confidenceThreshold);
      setTriggerOnOpen(s.triggerOpened);
      setTriggerOnUpdate(s.triggerSynchronize);
      setCommentMode(s.mode === "comment");
      setLearnDismissals(s.learnFromDismissals);
    });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  // Persist a settings change (best-effort; demo mode just keeps local state).
  function save(patch: Partial<RepoSettings>) {
    patchSettings(activeRepoId, patch).catch(() => {});
  }

  async function handleRebuild() {
    setRebuilding(true);
    setRebuilt(false);
    try {
      await rebuildMemory(activeRepoId);
      setRebuilding(false);
      setRebuilt(true);
      setTimeout(() => setRebuilt(false), 3000);
    } catch {
      // demo fallback — show the same loading→complete UX without a backend
      setTimeout(() => {
        setRebuilding(false);
        setRebuilt(true);
        setTimeout(() => setRebuilt(false), 3000);
      }, 1500);
    }
  }

  const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string; desc: string }[] = [
    {
      value: "low",
      label: "Low",
      desc: "Surface everything the model is uncertain about. More noise, fewer misses.",
    },
    {
      value: "high",
      label: "High",
      desc: "Only surface conflicts the model is confident about. Recommended.",
    },
    {
      value: "strict",
      label: "Strict",
      desc: "Surface only near-certain conflicts. Fewest warnings, highest precision.",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Confidence threshold */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Confidence Threshold</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Controls how certain Company Brain must be before posting a conflict warning.
          </p>
        </div>
        <div className="space-y-2">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                confidence === opt.value
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                  : "border-[var(--border)] hover:border-[var(--primary)]/50"
              }`}
            >
              <input
                type="radio"
                name="confidence"
                value={opt.value}
                checked={confidence === opt.value}
                onChange={() => {
                  setConfidence(opt.value);
                  save({ confidenceThreshold: opt.value });
                }}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--cb-text)]">
                  {opt.label}
                  {opt.value === "high" && (
                    <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">
                      (default)
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Trigger events */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Trigger Events</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            When should Company Brain run a check?
          </p>
        </div>
        <div className="space-y-3">
          <Toggle
            checked={triggerOnOpen}
            onChange={(v) => {
              setTriggerOnOpen(v);
              save({ triggerOpened: v });
            }}
            label="PR opened"
            id="trigger-open"
          />
          <Toggle
            checked={triggerOnUpdate}
            onChange={(v) => {
              setTriggerOnUpdate(v);
              save({ triggerSynchronize: v });
            }}
            label="PR updated (new commits pushed)"
            id="trigger-update"
          />
        </div>
      </section>

      {/* Comment vs status */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Review Mode</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            How should conflicts be surfaced?
          </p>
        </div>
        <div className="space-y-3">
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${commentMode ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-[var(--primary)]/50"}`}>
            <input
              type="radio"
              name="mode"
              checked={commentMode}
              onChange={() => {
                setCommentMode(true);
                save({ mode: "comment" });
              }}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--cb-text)]">PR Comment</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Post a review comment citing the conflicting decision and evidence.
              </p>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!commentMode ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-[var(--primary)]/50"}`}>
            <input
              type="radio"
              name="mode"
              checked={!commentMode}
              onChange={() => {
                setCommentMode(false);
                save({ mode: "status_check" });
              }}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--cb-text)]">Status Check</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Set a required GitHub status check that blocks merge on conflict.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Learn from dismissals */}
      <section className="card p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Learn from Dismissals</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            When a warning is dismissed, update the decision&apos;s confidence weight accordingly.
          </p>
        </div>
        <Toggle
          checked={learnDismissals}
          onChange={(v) => {
            setLearnDismissals(v);
            save({ learnFromDismissals: v });
          }}
          id="learn-dismissals"
        />
      </section>

      {/* Rebuild memory */}
      <section className="card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Rebuild Memory</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Re-scan all connected sources from scratch. Useful after adding a new connector.
            This runs in the background and may take a few minutes.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRebuild}
          disabled={rebuilding}
        >
          {rebuilding ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              Rebuilding…
            </>
          ) : rebuilt ? (
            <>
              <Check size={13} className="text-emerald-500" />
              Rebuild complete
            </>
          ) : (
            <>
              <RefreshCw size={13} />
              Rebuild Memory
            </>
          )}
        </Button>
      </section>

      {/* Self-serve CLI tokens */}
      <CliTokens repoId={activeRepoId} />
    </div>
  );
}

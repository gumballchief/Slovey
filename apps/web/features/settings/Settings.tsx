"use client";

import { ArrowsClockwiseIcon, KeyIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  createToken,
  fetchSettings,
  fetchTokens,
  patchSettings,
  rebuildMemory,
  revokeToken,
  type CliToken,
  type RepoSettings,
} from "@/lib/api-client";
import { CopyLine } from "@/features/preflight/Preflight";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { Button, Empty, ErrorState, IconButton, Modal, Segmented, Skeleton, Switch, errorMessage, timeAgo } from "@/ui/kit";

export function Settings() {
  return (
    <Page eyebrow="Settings" title="Repository settings" narrow>
      <NeedsRepo>{(repoId) => <SettingsFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

const CONFIDENCE: Array<{ value: RepoSettings["confidenceThreshold"]; label: string; desc: string }> = [
  { value: "low", label: "Catch more", desc: "Flags anything that might break a decision. More noise, fewer misses." },
  { value: "high", label: "Balanced", desc: "Flags changes Slovey is confident about. Recommended." },
  { value: "strict", label: "Strict", desc: "Flags only near-certain conflicts. Fewest warnings, highest precision." },
];

function SettingsFor({ repoId }: { repoId: string }) {
  const { repo } = useRepo();
  const s = useData(repoId, () => fetchSettings(repoId));
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  async function save(patch: Partial<RepoSettings>) {
    const prev = s.data;
    s.mutate((cur) => ({ ...(cur as RepoSettings), ...patch }));
    try {
      await patchSettings(repoId, patch);
      toast.success("Saved");
    } catch (e) {
      if (prev) s.mutate(prev);
      toast.error(errorMessage(e));
    }
  }

  return (
    <div style={{ display: "grid", gap: 48 }}>
      <section className="ui-section">
        <h2 className="ui-title ui-title--sm">Pull request checks</h2>
        {s.loading && <Skeleton h={220} r={14} />}
        {s.error != null && <ErrorState error={s.error} onRetry={s.reload} title="Settings didn't load" />}
        {s.data && (
          <div className="ui-card" style={{ padding: "4px 20px" }}>
            <div className="ui-setting" style={{ alignItems: "flex-start", flexDirection: "column" }}>
              <div>
                <div className="t">How sure Slovey must be before it flags</div>
                <div className="d">{CONFIDENCE.find((c) => c.value === s.data!.confidenceThreshold)?.desc}</div>
              </div>
              <Segmented
                label="Confidence"
                value={s.data.confidenceThreshold}
                onChange={(v) => save({ confidenceThreshold: v })}
                options={CONFIDENCE.map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
            <div className="ui-setting">
              <div>
                <div className="t">Check new pull requests</div>
                <div className="d">Runs when a pull request is opened or reopened.</div>
              </div>
              <Switch label="Check new pull requests" checked={s.data.triggerOpened} onCheckedChange={(v) => save({ triggerOpened: v })} />
            </div>
            <div className="ui-setting">
              <div>
                <div className="t">Re-check on every push</div>
                <div className="d">Runs again each time new commits land on an open pull request.</div>
              </div>
              <Switch label="Re-check on every push" checked={s.data.triggerSynchronize} onCheckedChange={(v) => save({ triggerSynchronize: v })} />
            </div>
            <div className="ui-setting">
              <div>
                <div className="t">Block merging</div>
                <div className="d">
                  Off: Slovey posts a review comment that cites the decision. On: it sets a GitHub status check that fails on a
                  conflict, so branch protection can block the merge.
                </div>
              </div>
              <Switch
                label="Block merging"
                checked={s.data.mode === "status_check"}
                onCheckedChange={(v) => save({ mode: v ? "status_check" : "comment" })}
              />
            </div>
            <div className="ui-setting">
              <div>
                <div className="t">Learn from false alarms</div>
                <div className="d">When someone marks a block as a false alarm, Slovey adjusts the decision so it doesn&apos;t repeat it.</div>
              </div>
              <Switch label="Learn from false alarms" checked={s.data.learnFromDismissals} onCheckedChange={(v) => save({ learnFromDismissals: v })} />
            </div>
          </div>
        )}
      </section>

      <CliTokens repoId={repoId} repoName={repo?.name} />

      <section className="ui-section">
        <h2 className="ui-title ui-title--sm">Memory</h2>
        <div className="ui-card" style={{ padding: "4px 20px" }}>
          <div className="ui-setting">
            <div>
              <div className="t">Re-learn from history</div>
              <div className="d">
                Reads your merged and rejected pull requests again and updates decisions. Use it after a big refactor. It
                runs in the background and can take a few minutes.
              </div>
            </div>
            <Button loading={rebuilding} onClick={() => setConfirmRebuild(true)} icon={<ArrowsClockwiseIcon size={15} />}>
              Re-learn
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={confirmRebuild}
        onOpenChange={setConfirmRebuild}
        title="Re-learn from history?"
        description="Slovey re-reads past pull requests and updates its decisions. Decisions you approved, edited or rejected keep your changes."
        actions={
          <>
            <Button onClick={() => setConfirmRebuild(false)}>Cancel</Button>
            <Button
              variant="light"
              loading={rebuilding}
              onClick={async () => {
                setRebuilding(true);
                try {
                  await rebuildMemory(repoId);
                  toast.success("Started. New and updated decisions will show up in Reviews.");
                  setConfirmRebuild(false);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setRebuilding(false);
                }
              }}
            >
              Re-learn
            </Button>
          </>
        }
      />
    </div>
  );
}

function CliTokens({ repoId, repoName }: { repoId: string; repoName?: string }) {
  const tokens = useData(`${repoId}|tokens`, () => fetchTokens(repoId));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<CliToken | null>(null);

  return (
    <section className="ui-section" id="cli">
      <h2 className="ui-title ui-title--sm">CLI and agents</h2>
      <p className="ui-small" style={{ color: "var(--text)" }}>
        Give your coding agent a token and it runs Preflight before every commit, checking each change against this
        repository&apos;s decisions.
      </p>
      <div className="ui-card ui-card--pad" style={{ display: "grid", gap: 14 }}>
        <div className="ui-label">1 · Install</div>
        <CopyLine text="npm i -g slovey" />
        <div className="ui-label">2 · Create a token</div>
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const t = await createToken(repoId, name.trim() || "cli");
              setFresh(t.token);
              setName("");
              tokens.reload();
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            className="ui-input"
            style={{ flex: 1, minWidth: 200 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it after where it runs: laptop, CI, Claude Code"
            maxLength={60}
          />
          <Button type="submit" variant="light" loading={busy} icon={<PlusIcon size={15} />}>
            Create token
          </Button>
        </form>
        <div className="ui-label">3 · Run it in {repoName ?? "the repository"}</div>
        <CopyLine text="SLOVEY_TOKEN=cb_… slovey preflight" />

        {tokens.loading && <Skeleton h={60} />}
        {tokens.error != null && <ErrorState error={tokens.error} onRetry={tokens.reload} title="Tokens didn't load" />}
        {tokens.data && tokens.data.length === 0 && (
          <Empty icon={<KeyIcon size={20} />} title="No tokens yet">Create one above. You see it once, so copy it right away.</Empty>
        )}
        {tokens.data && tokens.data.length > 0 && (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Token</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tokens.data.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--ink)", fontWeight: 600 }}>{t.name}</td>
                    <td className="ui-mono ui-muted">cb_…{t.tokenHint}</td>
                    <td className="ui-muted">{t.lastUsedAt ? timeAgo(t.lastUsedAt) : "Never"}</td>
                    <td style={{ textAlign: "right" }}>
                      <IconButton label={`Revoke ${t.name}`} small onClick={() => setRevoking(t)}>
                        <TrashIcon size={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={fresh != null}
        onOpenChange={(v) => !v && setFresh(null)}
        title="Your new token"
        description="Copy it now. For your security it won't be shown again."
        actions={<Button variant="light" onClick={() => setFresh(null)}>Done</Button>}
      >
        {fresh && <CopyLine text={fresh} />}
      </Modal>
      <Modal
        open={revoking != null}
        onOpenChange={(v) => !v && setRevoking(null)}
        title={`Revoke “${revoking?.name ?? ""}”?`}
        description="Anything using it stops passing Preflight until it gets a new token."
        actions={
          <>
            <Button onClick={() => setRevoking(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!revoking) return;
                try {
                  await revokeToken(repoId, revoking.id);
                  toast.success("Revoked.");
                  setRevoking(null);
                  tokens.reload();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Revoke
            </Button>
          </>
        }
      />
    </section>
  );
}

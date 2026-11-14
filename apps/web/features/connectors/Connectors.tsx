"use client";

import {
  ArrowsClockwiseIcon,
  BookOpenIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  KanbanIcon,
  PlugsConnectedIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { connectConnector, disconnectConnector, fetchConnectors, syncConnector } from "@/lib/api-client";
import type { Connector } from "@/lib/data";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Button, Empty, ErrorState, Modal, RowsSkeleton, errorMessage, timeAgo } from "@/ui/kit";

const LOGO: Record<string, string> = {
  github: "/logos/github.svg",
  notion: "/logos/notion.svg",
  jira: "/logos/jira.svg",
  pagerduty: "/logos/pagerduty.svg",
};
const FALLBACK_ICON: Record<string, React.ReactNode> = {
  slack: <ChatsCircleIcon size={20} />,
  discord: <ChatsCircleIcon size={20} />,
  linear: <KanbanIcon size={20} />,
  confluence: <BookOpenIcon size={20} />,
};

const TOKEN_HINT: Record<string, string> = {
  linear: "Linear personal API key (lin_api_…)",
  notion: "Notion internal integration token (secret_… or ntn_…)",
  slack: "Slack bot token (xoxb-…)",
  jira: "Atlassian API token (id.atlassian.com → API tokens)",
  confluence: "Atlassian API token (the same one as Jira)",
  discord: "Discord bot token",
  pagerduty: "PagerDuty API key",
};
type FieldKey = "baseUrl" | "email" | "channels";
const FIELDS: Record<string, Array<{ key: FieldKey; label: string; placeholder: string }>> = {
  jira: [
    { key: "baseUrl", label: "Site URL", placeholder: "https://acme.atlassian.net" },
    { key: "email", label: "Account email", placeholder: "you@acme.com" },
  ],
  confluence: [
    { key: "baseUrl", label: "Site URL", placeholder: "https://acme.atlassian.net" },
    { key: "email", label: "Account email", placeholder: "you@acme.com" },
  ],
  discord: [{ key: "channels", label: "Channel IDs", placeholder: "123456789, 987654321" }],
  slack: [{ key: "channels", label: "Channel IDs (optional)", placeholder: "C0123, C0456" }],
};
const LAYERS: Record<number, { title: string; desc: string }> = {
  1: { title: "Always on", desc: "Learned straight from GitHub. Nothing to set up." },
  2: { title: "Repository docs", desc: "ADRs, READMEs and docs in the repo, read on every sync." },
  3: { title: "Your team's tools", desc: "Where decisions get made outside code review. Each one adds context Slovey can cite." },
  4: { title: "Coming soon", desc: "On the way." },
};

export function Connectors() {
  return (
    <Page
      eyebrow="Connectors"
      title={
        <>
          Where your decisions <span className="dim">get made.</span>
        </>
      }
      intro="Slovey learns from GitHub by itself. Connect the tools where your team discusses and documents decisions, and it can cite those too."
    >
      <NeedsRepo>{(repoId) => <ConnectorsFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

function ConnectorsFor({ repoId }: { repoId: string }) {
  const list = useData(repoId, () => fetchConnectors(repoId));
  const [connecting, setConnecting] = useState<Connector | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function sync(c: Connector) {
    setBusy(c.id);
    try {
      await syncConnector(repoId, c.id);
      toast.success(`Syncing ${c.name}. New decisions appear in Reviews.`);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (list.loading) return <RowsSkeleton rows={5} />;
  if (list.error != null) return <ErrorState error={list.error} onRetry={list.reload} title="Connectors didn't load" />;
  const all = list.data ?? [];
  if (all.length === 0) return <Empty icon={<PlugsConnectedIcon size={22} />} title="No connectors available" />;

  return (
    <div style={{ display: "grid", gap: 40 }}>
      {[1, 2, 3, 4].map((layer) => {
        const items = all.filter((c) => c.layer === layer);
        if (!items.length) return null;
        return (
          <section key={layer} className="ui-section">
            <div>
              <h2 className="ui-title ui-title--sm">{LAYERS[layer]!.title}</h2>
              <p className="ui-small" style={{ marginTop: 6 }}>{LAYERS[layer]!.desc}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {items.map((c) => (
                <article key={c.id} className="ui-card ui-card--pad" style={{ display: "grid", gap: 12, alignContent: "start", opacity: c.status === "coming_soon" ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="ui-row-icon" style={{ width: 40, height: 40 }}>
                      {LOGO[c.id] ? <img src={LOGO[c.id]} alt="" width={20} height={20} /> : (FALLBACK_ICON[c.id] ?? <PlugsConnectedIcon size={20} />)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ui-h3">{c.name}</div>
                      {c.status === "connected" && (
                        <div className="ui-small">
                          {c.syncing ? "Syncing now" : c.lastSyncedAt ? `Synced ${timeAgo(c.lastSyncedAt)}` : "Connected"}
                        </div>
                      )}
                    </div>
                    {c.status === "connected" ? (
                      c.lastError ? (
                        <Badge tone="red"><WarningCircleIcon size={13} weight="fill" /> Error</Badge>
                      ) : (
                        <Badge tone="green"><CheckCircleIcon size={13} weight="fill" /> On</Badge>
                      )
                    ) : c.status === "coming_soon" ? (
                      <Badge>Soon</Badge>
                    ) : null}
                  </div>
                  <p className="ui-small" style={{ color: "var(--text)" }}>{c.description}</p>
                  {c.deepens && <p className="ui-small">{c.deepens}</p>}
                  {c.lastError && <p className="ui-small" style={{ color: "var(--red-ink)" }}>{c.lastError}</p>}
                  {c.layer === 3 && c.status === "available" && (
                    <div>
                      <Button size="sm" variant="light" onClick={() => setConnecting(c)}>
                        Connect
                      </Button>
                    </div>
                  )}
                  {c.layer === 3 && c.status === "connected" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" loading={busy === c.id} onClick={() => sync(c)} icon={<ArrowsClockwiseIcon size={14} />}>
                        Sync now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(c)}>
                        Disconnect
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
      <ConnectModal connector={connecting} repoId={repoId} onClose={() => setConnecting(null)} onDone={list.reload} />
      <Modal
        open={removing != null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Disconnect ${removing?.name ?? ""}?`}
        description="Slovey stops syncing from it and deletes the saved token. Decisions it already learned stay in your memory."
        actions={
          <>
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="danger"
              loading={busy === "remove"}
              onClick={async () => {
                if (!removing) return;
                setBusy("remove");
                try {
                  await disconnectConnector(repoId, removing.id);
                  toast.success(`${removing.name} disconnected.`);
                  setRemoving(null);
                  list.reload();
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Disconnect
            </Button>
          </>
        }
      />
    </div>
  );
}

function ConnectModal({
  connector,
  repoId,
  onClose,
  onDone,
}: {
  connector: Connector | null;
  repoId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [token, setToken] = useState("");
  const [fields, setFields] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const c = connector;
  const extra = c ? (FIELDS[c.id] ?? []) : [];

  return (
    <Modal
      open={c != null}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setToken("");
          setFields({});
        }
      }}
      title={`Connect ${c?.name ?? ""}`}
      description="The token is encrypted before it's stored and is only used to read. Slovey never writes to your tools."
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="light"
            loading={busy}
            disabled={!token.trim() || extra.some((f) => !f.label.includes("optional") && !fields[f.key]?.trim())}
            onClick={async () => {
              if (!c) return;
              setBusy(true);
              try {
                const config: { channels?: string[]; baseUrl?: string; email?: string } = {};
                for (const f of extra) {
                  const v = fields[f.key]?.trim();
                  if (!v) continue;
                  if (f.key === "channels") config.channels = v.split(",").map((s) => s.trim()).filter(Boolean);
                  else config[f.key] = v;
                }
                await connectConnector(repoId, c.id, token.trim(), config);
                toast.success(`${c.name} connected. The first sync is running.`);
                setToken("");
                setFields({});
                onClose();
                onDone();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Connect
          </Button>
        </>
      }
    >
      {extra.map((f) => (
        <label key={f.key} className="ui-field">
          <span>{f.label}</span>
          <input
            className="ui-input"
            value={fields[f.key] ?? ""}
            onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
          />
        </label>
      ))}
      <label className="ui-field">
        <span>{c ? (TOKEN_HINT[c.id] ?? "API token") : "API token"}</span>
        <input
          className="ui-input"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the token"
        />
      </label>
    </Modal>
  );
}

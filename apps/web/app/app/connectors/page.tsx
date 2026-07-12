"use client";

import type { Connector } from "@/lib/data";
import { useRepo } from "@/app/app/RepoProvider";
import {
  fetchConnectors,
  connectConnector,
  syncConnector,
  disconnectConnector,
} from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  GitBranch,
  FileText,
  BookOpen,
  Layers,
  LayoutGrid,
  Layout,
  Database,
  MessageSquare,
  Hash,
  Video,
  CheckCircle2,
  Zap,
  Lock,
  RefreshCw,
  Trash2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  github: GitBranch,
  "file-text": FileText,
  "book-open": BookOpen,
  layers: Layers,
  trello: LayoutGrid,
  layout: Layout,
  database: Database,
  "message-square": MessageSquare,
  hash: Hash,
  video: Video,
};

const TOKEN_HINTS: Record<string, string> = {
  linear: "Linear personal API key (lin_api_…)",
  notion: "Notion internal integration token (secret_… or ntn_…)",
  slack: "Slack bot token (xoxb-…)",
  jira: "Atlassian API token (id.atlassian.com → API tokens)",
  confluence: "Atlassian API token (same as Jira)",
  discord: "Discord bot token",
};

// Extra fields some connectors need, collected alongside the token.
const CONFIG_FIELDS: Record<
  string,
  Array<{ key: "baseUrl" | "email" | "channels"; label: string; placeholder: string }>
> = {
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

const LAYER_LABELS: Record<number, string> = {
  1: "Layer 1 — Live (Always On)",
  2: "Layer 2 — Repo Docs",
  3: "Layer 3 — Project Tools",
  4: "Layer 4 — Coming Soon",
};

const LAYER_DESCRIPTIONS: Record<number, string> = {
  1: "Your code and PR history. Ingested automatically.",
  2: "ADRs, README, CONTRIBUTING, and /docs. Connected by default.",
  3: "Linear, Notion, Slack. Connect to deepen the memory.",
  4: "Jira, Confluence, Discord, meeting notes. On the roadmap.",
};

function ConnectorCard({
  connector,
  repoId,
  onChange,
}: {
  connector: Connector;
  repoId: string;
  onChange: () => void;
}) {
  const [token, setToken] = useState("");
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICON_MAP[connector.icon] ?? Database;
  const configFields = CONFIG_FIELDS[connector.id] ?? [];

  function buildConfig() {
    const config: { channels?: string[]; baseUrl?: string; email?: string } = {};
    for (const f of configFields) {
      const v = (cfg[f.key] ?? "").trim();
      if (!v) continue;
      if (f.key === "channels") config.channels = v.split(",").map((s) => s.trim()).filter(Boolean);
      else config[f.key] = v;
    }
    return config;
  }

  const isConnected = connector.status === "connected";
  const isComingSoon = connector.status === "coming_soon";
  const isLive = connector.layer <= 2; // github/readme/adrs — managed automatically
  const canConnect = connector.status === "available";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setToken("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card ${isComingSoon ? "opacity-60" : "card-hover"} p-5 space-y-3`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isConnected || isLive
              ? "bg-emerald-500/10 text-emerald-500"
              : isComingSoon
                ? "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                : "bg-[var(--primary-soft)] text-[var(--primary)]"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--cb-text)]">{connector.name}</h3>
            {(isConnected || isLive) && (
              <Badge variant="approved">
                <CheckCircle2 size={10} />
                {isLive ? "Live" : "Connected"}
              </Badge>
            )}
            {connector.syncing && <Badge variant="suggested">Syncing…</Badge>}
            {isComingSoon && (
              <Badge variant="default">
                <Lock size={10} />
                Coming soon
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{connector.description}</p>
        </div>
      </div>

      <p className="text-xs text-[var(--cb-text)] leading-relaxed border-l-2 border-[var(--primary-soft)] pl-3">
        <span className="text-[var(--primary)] font-medium">Deepens: </span>
        {connector.deepens}
      </p>

      {connector.lastError && (
        <p className="text-xs text-[#F43F5E] flex items-center gap-1">
          <AlertTriangle size={11} /> {connector.lastError}
        </p>
      )}

      {/* Connect form */}
      {canConnect && (
        <div className="space-y-2">
          {configFields.map((f) => (
            <input
              key={f.key}
              type="text"
              value={cfg[f.key] ?? ""}
              onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
              placeholder={f.label + " — " + f.placeholder}
              className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          ))}
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={TOKEN_HINTS[connector.id] ?? "API token"}
            className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !token.trim()}
            onClick={() => run(() => connectConnector(repoId, connector.id, token.trim(), buildConfig()))}
          >
            {busy ? (
              <>
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Zap size={13} />
                Connect
              </>
            )}
          </Button>
          {error && <p className="text-xs text-[#F43F5E]">{error}</p>}
        </div>
      )}

      {/* Connected controls */}
      {isConnected && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--text-muted)]">
            {connector.lastSyncedAt
              ? `Synced ${formatRelativeTime(connector.lastSyncedAt)}`
              : "Not yet synced"}
          </span>
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => run(() => syncConnector(repoId, connector.id))}
            >
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
              Sync
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => run(() => disconnectConnector(repoId, connector.id))}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      )}
      {error && isConnected && <p className="text-xs text-[#F43F5E]">{error}</p>}
    </div>
  );
}

export default function ConnectorsPage() {
  const { activeRepoId } = useRepo();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const layers = [1, 2, 3, 4] as const;

  function load() {
    fetchConnectors(activeRepoId).then(setConnectors);
  }
  useEffect(load, [activeRepoId]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Memory depth callout */}
      <div
        className="card p-5 flex items-start gap-4"
        style={{ borderColor: "var(--primary-soft)", background: "var(--primary-soft)" }}
      >
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center shrink-0">
          <Layers size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">
            Each connector deepens the memory
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
            Slovey starts from your PR history and grows smarter with every source you connect.
            Decisions from Linear, Notion, and Slack become citable warnings on PRs.
          </p>
        </div>
      </div>

      {layers.map((layer) => {
        const layerConnectors = connectors.filter((c) => c.layer === layer);
        if (layerConnectors.length === 0) return null;
        return (
          <section key={layer} aria-labelledby={`layer-${layer}`}>
            <div className="mb-4">
              <h2
                id={`layer-${layer}`}
                className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5"
              >
                {LAYER_LABELS[layer]}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">{LAYER_DESCRIPTIONS[layer]}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 stagger">
              {layerConnectors.map((c) => (
                <ConnectorCard key={c.id} connector={c} repoId={activeRepoId} onChange={load} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

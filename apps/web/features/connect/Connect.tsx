"use client";

import "./connect.css";
import { CheckCircleIcon, CodeIcon, KeyIcon, PlugIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { createToken, fetchTokens, type CliToken } from "@/lib/api-client";
import { SITE_URL } from "@/lib/site";
import { Button, CodeBlock, CopyLine, cx, errorMessage, timeAgo } from "@/ui/kit";

type ToolId = "claude" | "claude-code" | "cursor" | "vscode" | "other";

const TOOLS: Array<{ id: ToolId; name: string; logo?: string; icon?: ReactNode }> = [
  { id: "claude", name: "Claude", logo: "/logos/claude.svg" },
  { id: "claude-code", name: "Claude Code", logo: "/logos/claude.svg" },
  { id: "cursor", name: "Cursor", logo: "/logos/cursor.svg" },
  { id: "vscode", name: "VS Code", icon: <CodeIcon size={20} /> },
  { id: "other", name: "Other clients", icon: <PlugIcon size={20} /> },
];

const PLACEHOLDER = "cb_YOUR_KEY";

const TRY_PROMPTS = [
  "What has our team decided about payments?",
  "Before you start, ask Slovey which decisions apply to the files you're changing.",
  "Check this change with Slovey before you commit.",
];

/** Keys minted by "Sign in with Slovey" are named after the client, e.g. "Claude (connector)". */
const isConnectorKey = (t: CliToken) => t.name.endsWith("(connector)");
const latestUse = (rows: CliToken[]) =>
  rows.reduce((max, t) => (t.lastUsedAt && Date.parse(t.lastUsedAt) > max ? Date.parse(t.lastUsedAt) : max), 0);

export function Connect() {
  return <NeedsRepo>{(repoId) => <ConnectFor repoId={repoId} />}</NeedsRepo>;
}

function ConnectFor({ repoId }: { repoId: string }) {
  const { repo } = useRepo();
  const repoName = repo?.name ?? "this repository";
  const tokens = useData(`${repoId}|tokens`, () => fetchTokens(repoId));
  const [tool, setTool] = useState<ToolId>("claude");
  const [fresh, setFresh] = useState<{ id: string; token: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState(SITE_URL);

  // The endpoint lives on whatever host serves this dashboard (slovey.ai, or a self-hosted copy).
  useEffect(() => setOrigin(window.location.origin), []);

  // "Connected" means an agent reached Slovey after this page opened: a connector key
  // (from signing in) or the key made here was used. Every call stamps last-used.
  const rows = tokens.data ?? [];
  const baseline = useRef<number | null>(null);

  // Keys are per repository, so switching repositories starts over.
  const [keyRepo, setKeyRepo] = useState(repoId);
  if (keyRepo !== repoId) {
    setKeyRepo(repoId);
    setFresh(null);
    baseline.current = null;
  }
  if (baseline.current === null && tokens.data) baseline.current = latestUse(rows);
  const watched = rows.filter((t) => isConnectorKey(t) || t.id === fresh?.id);
  const newest = latestUse(watched);
  const connectedNow = baseline.current !== null && newest > baseline.current;
  const lastConnector = rows.filter(isConnectorKey).sort((a, b) => latestUse([b]) - latestUse([a]))[0];

  const reload = tokens.reload;
  useEffect(() => {
    if (connectedNow) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [connectedNow, reload]);

  const key = fresh?.token ?? PLACEHOLDER;
  const url = `${origin}/api/mcp`;
  const toolName = TOOLS.find((t) => t.id === tool)!.name;
  const signsIn = tool !== "other";

  async function makeKey(name: string) {
    setCreating(true);
    try {
      const t = await createToken(repoId, name);
      setFresh({ id: t.id, token: t.token });
      tokens.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  const keyStep = (
    <Step title="Create a key" done={Boolean(fresh)}>
      {fresh ? (
        <>
          <CopyLine text={fresh.token} label="Copy key" />
          <p className="ui-small">Shown once and already filled in below. Lost it? Make another; old keys are in Settings.</p>
        </>
      ) : (
        <>
          <p className="ui-small">A key reads {repoName}&apos;s decisions, and nothing else.</p>
          <Button variant="light" loading={creating} icon={<KeyIcon size={15} />} onClick={() => makeKey(toolName)}>
            Create a key
          </Button>
        </>
      )}
    </Step>
  );

  return (
    <Page
      narrow
      eyebrow="Connect"
      title={
        <>
          Plug Slovey into <span className="dim">your agent.</span>
        </>
      }
      intro={
        <>
          Once connected, your coding agent asks Slovey before it writes code and checks its change before it commits, so
          it follows {repoName}&apos;s decisions. Nothing to install: you add one address and sign in with Slovey.
        </>
      }
    >
      <section className="ui-section">
        <div className="ui-label">Your agent</div>
        <div className="cn-tools" role="group" aria-label="Choose your agent">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className="cn-tool" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              <span className="cn-tool-mark">{t.logo ? <img src={t.logo} alt="" width={20} height={20} /> : t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="ui-section">
        <div className="ui-card ui-card--raised cn-panel">
          {!signsIn && keyStep}
          <Step title={signsIn ? `Add Slovey to ${toolName}` : "Point your client at Slovey"} done={connectedNow}>
            <ToolSteps tool={tool} url={url} apiKey={key} />
          </Step>
          {signsIn && (
            <Step title="Sign in with Slovey" done={connectedNow}>
              <p className="ui-small">
                {toolName} opens a Slovey page. Sign in, pick {repoName} or another repository, and click Allow. There&apos;s
                no key to copy, and you can remove access any time in Settings.
              </p>
            </Step>
          )}
          <Step title="Check it worked" done={connectedNow} last>
            <Status connected={connectedNow} at={newest} toolName={toolName} last={lastConnector} />
          </Step>
        </div>
      </section>

      <section className="ui-section">
        <div className="ui-label">Then try asking your agent</div>
        <div className="cn-prompts">
          {TRY_PROMPTS.map((p) => (
            <CopyLine key={p} text={p} />
          ))}
        </div>
      </section>

      <section className="ui-section" id="gate">
        <h2 className="ui-title ui-title--sm">The commit gate</h2>
        <p className="ui-small cn-lede">
          Slovey can also run on your machine and in CI, so a commit that breaks a decision is stopped before it lands,
          whoever or whatever wrote it. This part uses a key.
        </p>
        <div className="ui-card ui-card--pad cn-gate">
          <GateRow label="Install the command">
            <CopyLine text="npm i -g slovey" />
          </GateRow>
          <GateRow label="Give it a key">
            {!fresh && (
              <Button loading={creating} icon={<KeyIcon size={15} />} onClick={() => makeKey("Commit gate")}>
                Create a key
              </Button>
            )}
            <CopyLine text={`export SLOVEY_TOKEN=${key}`} />
            <span className="ui-small">On Windows (PowerShell), instead:</span>
            <CopyLine text={`setx SLOVEY_TOKEN ${key}`} />
          </GateRow>
          <GateRow label={`Turn it on in ${repoName}`}>
            <CopyLine text="slovey preflight --install-hooks" />
            <span className="ui-small">Every commit and push now runs the check. Run it any time with slovey preflight.</span>
          </GateRow>
          <GateRow label="In CI">
            <CopyLine text="npx -y slovey preflight --mode push" />
            <span className="ui-small">Store the key as a secret named SLOVEY_TOKEN in your CI settings.</span>
          </GateRow>
        </div>
      </section>
    </Page>
  );
}

function Step({ title, done, last, children }: { title: string; done: boolean; last?: boolean; children: ReactNode }) {
  return (
    <div className={cx("cn-step", last && "cn-step--last")} data-done={done}>
      <span className="cn-step-dot" aria-hidden>
        {done && <CheckCircleIcon size={18} weight="fill" />}
      </span>
      <div className="cn-step-body">
        <h3 className="ui-h3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function GateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cn-gate-row">
      <div className="cn-gate-label">{label}</div>
      <div className="cn-gate-body">{children}</div>
    </div>
  );
}

function ToolSteps({ tool, url, apiKey }: { tool: ToolId; url: string; apiKey: string }) {
  if (tool === "claude") {
    return (
      <>
        <p className="ui-small">
          In Claude, open Settings, then Connectors, and click Add custom connector. Name it Slovey and paste this
          address, then click Add and Connect:
        </p>
        <CopyLine text={url} />
        <p className="ui-small">
          Works in the Claude app and on claude.ai. On Team and Enterprise plans, an owner adds it once under Organization
          settings and everyone connects their own account.
        </p>
      </>
    );
  }

  if (tool === "claude-code") {
    return (
      <>
        <p className="ui-small">Run this once in a terminal:</p>
        <CopyLine text={`claude mcp add --transport http slovey ${url}`} />
        <p className="ui-small">
          Then in Claude Code type <code className="ui-code-inline">/mcp</code>, choose slovey and pick Authenticate.
        </p>
      </>
    );
  }

  if (tool === "cursor") {
    const server = { url };
    const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=slovey&config=${encodeURIComponent(
      btoa(JSON.stringify(server)),
    )}`;
    return (
      <>
        <OneClick href={deeplink} label="Add to Cursor" logo="/logos/cursor.svg" />
        <p className="ui-small">Or add it to ~/.cursor/mcp.json yourself. Cursor asks you to sign in the first time.</p>
        <CodeBlock title="mcp.json" code={JSON.stringify({ mcpServers: { slovey: server } }, null, 2)} />
      </>
    );
  }

  if (tool === "vscode") {
    const server = { type: "http", url };
    const deeplink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "slovey", ...server }))}`;
    return (
      <>
        <OneClick href={deeplink} label="Add to VS Code" icon={<CodeIcon size={16} />} />
        <p className="ui-small">Or add it to .vscode/mcp.json in your repository. VS Code asks you to sign in the first time.</p>
        <CodeBlock title=".vscode/mcp.json" code={JSON.stringify({ servers: { slovey: server } }, null, 2)} />
      </>
    );
  }

  return (
    <>
      <p className="ui-small">
        Clients that support remote MCP sign in with Slovey on their own using this address. For one that can&apos;t,
        send the key above as a header.
      </p>
      <CopyLine text={url} />
      <CopyLine text={`Authorization: Bearer ${apiKey}`} />
    </>
  );
}

function OneClick({ href, label, logo, icon }: { href: string; label: string; logo?: string; icon?: ReactNode }) {
  return (
    <div className="cn-oneclick">
      <a className="ui-btn ui-btn--light" href={href}>
        {logo ? <img src={logo} alt="" width={16} height={16} /> : icon}
        {label}
      </a>
    </div>
  );
}

function Status({
  connected,
  at,
  toolName,
  last,
}: {
  connected: boolean;
  at: number;
  toolName: string;
  last: CliToken | undefined;
}) {
  if (connected) {
    return (
      <div className="cn-status" data-state="ok">
        <CheckCircleIcon size={18} weight="fill" />
        Connected. Your agent reached Slovey {timeAgo(new Date(at).toISOString())}.
      </div>
    );
  }
  return (
    <>
      <div className="cn-status" data-state="wait">
        <SpinnerGapIcon size={18} className="cn-spin" />
        Waiting for {toolName}. This turns green the moment it first calls Slovey.
      </div>
      {last?.lastUsedAt && (
        <p className="ui-small">
          {last.name.replace(/ \(connector\)$/, "")} last reached Slovey {timeAgo(last.lastUsedAt)}.
        </p>
      )}
    </>
  );
}

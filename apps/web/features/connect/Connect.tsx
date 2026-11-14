"use client";

import "./connect.css";
import { CheckCircleIcon, CodeIcon, KeyIcon, PlugIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { createToken, fetchTokens } from "@/lib/api-client";
import { SITE_URL } from "@/lib/site";
import { Button, CodeBlock, CopyLine, cx, errorMessage, timeAgo } from "@/ui/kit";

type ToolId = "claude-code" | "claude-desktop" | "cursor" | "vscode" | "other";

const TOOLS: Array<{ id: ToolId; name: string; logo?: string; icon?: ReactNode }> = [
  { id: "claude-code", name: "Claude Code", logo: "/logos/claude.svg" },
  { id: "claude-desktop", name: "Claude Desktop", logo: "/logos/claude.svg" },
  { id: "cursor", name: "Cursor", logo: "/logos/cursor.svg" },
  { id: "vscode", name: "VS Code", icon: <CodeIcon size={20} /> },
  { id: "other", name: "Any MCP client", icon: <PlugIcon size={20} /> },
];

const PLACEHOLDER = "cb_YOUR_KEY";

const TRY_PROMPTS = [
  "What has our team decided about payments?",
  "Before you start, ask Slovey which decisions apply to the files you're changing.",
  "Check this change with Slovey before you commit.",
];

export function Connect() {
  return <NeedsRepo>{(repoId) => <ConnectFor repoId={repoId} />}</NeedsRepo>;
}

function ConnectFor({ repoId }: { repoId: string }) {
  const { repo } = useRepo();
  const repoName = repo?.name ?? "this repository";
  const tokens = useData(`${repoId}|tokens`, () => fetchTokens(repoId));
  const [tool, setTool] = useState<ToolId>("claude-code");
  const [fresh, setFresh] = useState<{ id: string; token: string; tool: ToolId } | null>(null);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState(SITE_URL);

  // The endpoint lives on whatever host serves this dashboard (slovey.ai, or a self-hosted copy).
  useEffect(() => setOrigin(window.location.origin), []);

  // A key is per repository, so switching repositories forgets the one made for the last.
  const [keyRepo, setKeyRepo] = useState(repoId);
  if (keyRepo !== repoId) {
    setKeyRepo(repoId);
    setFresh(null);
  }

  const freshRow = fresh ? tokens.data?.find((t) => t.id === fresh.id) : undefined;
  const connected = Boolean(freshRow?.lastUsedAt);

  // Watch for the agent's first call: every request with the key stamps its last-used time.
  const reload = tokens.reload;
  useEffect(() => {
    if (!fresh || connected) return;
    const timer = window.setInterval(reload, 4000);
    return () => window.clearInterval(timer);
  }, [fresh, connected, reload]);

  const lastUsed = (tokens.data ?? [])
    .filter((t) => t.lastUsedAt)
    .sort((a, b) => Date.parse(b.lastUsedAt!) - Date.parse(a.lastUsedAt!))[0];

  const key = fresh?.token ?? PLACEHOLDER;
  const url = `${origin}/api/mcp`;
  const toolName = TOOLS.find((t) => t.id === tool)!.name;

  async function makeKey() {
    setCreating(true);
    try {
      const t = await createToken(repoId, toolName);
      setFresh({ id: t.id, token: t.token, tool });
      tokens.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

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
          it follows {repoName}&apos;s decisions. Nothing to install: it connects over the web with a key.
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
          <Step title="Create a key" done={Boolean(fresh)}>
            {fresh ? (
              <>
                <CopyLine text={fresh.token} label="Copy key" />
                <p className="ui-small">
                  Shown once and already filled into the steps below. Lost it? Make another; old keys are listed in
                  Settings.
                </p>
              </>
            ) : (
              <>
                <p className="ui-small">A key lets {toolName} read {repoName}&apos;s decisions, and nothing else.</p>
                <Button variant="light" loading={creating} icon={<KeyIcon size={15} />} onClick={makeKey}>
                  Create a key for {toolName}
                </Button>
              </>
            )}
          </Step>

          <Step title={tool === "other" ? "Point your client at Slovey" : `Add Slovey to ${toolName}`} done={connected}>
            <ToolSteps tool={tool} url={url} apiKey={key} hasKey={Boolean(fresh)} />
          </Step>

          <Step title="Check it worked" done={connected} last>
            <Status fresh={fresh} connected={connected} usedAt={freshRow?.lastUsedAt} lastUsed={lastUsed} toolName={toolName} />
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
          whoever or whatever wrote it.
        </p>
        <div className="ui-card ui-card--pad cn-gate">
          <GateRow label="Install the command">
            <CopyLine text="npm i -g slovey" />
          </GateRow>
          <GateRow label="Give it your key">
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

function ToolSteps({ tool, url, apiKey, hasKey }: { tool: ToolId; url: string; apiKey: string; hasKey: boolean }) {
  const auth = `Bearer ${apiKey}`;

  if (tool === "claude-code") {
    return (
      <>
        <p className="ui-small">Run this once in a terminal:</p>
        <CopyLine text={`claude mcp add --transport http slovey ${url} --header "Authorization: ${auth}"`} />
        <p className="ui-small">
          Then open Claude Code in your repository and type <code className="ui-code-inline">/mcp</code>. Slovey shows as
          connected.
        </p>
      </>
    );
  }

  if (tool === "claude-desktop") {
    const config = {
      mcpServers: {
        slovey: {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${SLOVEY_AUTH}"],
          env: { SLOVEY_AUTH: auth },
        },
      },
    };
    return (
      <>
        <p className="ui-small">
          In Claude Desktop open Settings, then Developer, then Edit Config. Paste this into the file, save, and restart
          Claude. It needs Node.js on your computer.
        </p>
        <CodeBlock title="claude_desktop_config.json" code={JSON.stringify(config, null, 2)} />
        <p className="ui-small">
          Using Claude in the browser instead? claude.ai connectors need a sign-in flow Slovey doesn&apos;t offer yet, so
          use Claude Desktop or Claude Code for now.
        </p>
      </>
    );
  }

  if (tool === "cursor") {
    const server = { url, headers: { Authorization: auth } };
    const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=slovey&config=${encodeURIComponent(
      btoa(JSON.stringify(server)),
    )}`;
    return (
      <>
        <OneClick href={deeplink} enabled={hasKey} label="Add to Cursor" logo="/logos/cursor.svg" />
        <p className="ui-small">Or paste it into ~/.cursor/mcp.json yourself:</p>
        <CodeBlock title="mcp.json" code={JSON.stringify({ mcpServers: { slovey: server } }, null, 2)} />
      </>
    );
  }

  if (tool === "vscode") {
    const server = { type: "http", url, headers: { Authorization: auth } };
    const deeplink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "slovey", ...server }))}`;
    return (
      <>
        <OneClick href={deeplink} enabled={hasKey} label="Add to VS Code" icon={<CodeIcon size={16} />} />
        <p className="ui-small">Or add it to .vscode/mcp.json in your repository:</p>
        <CodeBlock title=".vscode/mcp.json" code={JSON.stringify({ servers: { slovey: server } }, null, 2)} />
      </>
    );
  }

  return (
    <>
      <p className="ui-small">Any client that supports remote (Streamable HTTP) MCP servers works. Server address:</p>
      <CopyLine text={url} />
      <p className="ui-small">Send this header with every request:</p>
      <CopyLine text={`Authorization: ${auth}`} />
    </>
  );
}

function OneClick({
  href,
  enabled,
  label,
  logo,
  icon,
}: {
  href: string;
  enabled: boolean;
  label: string;
  logo?: string;
  icon?: ReactNode;
}) {
  const mark = logo ? <img src={logo} alt="" width={16} height={16} /> : icon;
  if (!enabled) {
    return (
      <div className="cn-oneclick">
        <span className="ui-btn ui-btn--light" aria-disabled="true" data-disabled="true">
          {mark}
          {label}
        </span>
        <span className="ui-small">Create a key first.</span>
      </div>
    );
  }
  return (
    <div className="cn-oneclick">
      <a className="ui-btn ui-btn--light" href={href}>
        {mark}
        {label}
      </a>
    </div>
  );
}

function Status({
  fresh,
  connected,
  usedAt,
  lastUsed,
  toolName,
}: {
  fresh: { tool: ToolId } | null;
  connected: boolean;
  usedAt: string | null | undefined;
  lastUsed: { name: string; lastUsedAt: string | null } | undefined;
  toolName: string;
}) {
  if (fresh && connected) {
    return (
      <div className="cn-status" data-state="ok">
        <CheckCircleIcon size={18} weight="fill" />
        Connected. Your agent reached Slovey {usedAt ? timeAgo(usedAt) : "just now"}.
      </div>
    );
  }
  if (fresh) {
    return (
      <div className="cn-status" data-state="wait">
        <SpinnerGapIcon size={18} className="cn-spin" />
        Waiting for {toolName} to call Slovey. Finish the step above, then ask your agent anything about your code.
      </div>
    );
  }
  if (lastUsed?.lastUsedAt) {
    return (
      <p className="ui-small">
        An agent last used the key &ldquo;{lastUsed.name}&rdquo; {timeAgo(lastUsed.lastUsedAt)}. A new key shows a live
        check here.
      </p>
    );
  }
  return <p className="ui-small">This turns green the moment your agent first calls Slovey.</p>;
}

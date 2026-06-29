# Company Brain — V1 Readiness Audit

> Brutally honest, per Master Prompt XXX. Scenario: "$20M raised, launch
> tomorrow, thousands sign up." Grounded in what is *verified to exist*, not what
> the master prompts describe. Scores are 1–10.

## The verdict (read this first)

**The platform is well-built and the core idea is real, but it is NOT ready for a
big public launch — because it has zero users, an empty-graph cold-start, and the
live loop isn't actually wired to a deployed instance yet.** This is not a
tech-readiness problem; the engineering is genuinely good. It's an *adoption and
proof* problem. The right move is a **narrow private beta (5–20 design partners)
behind the MCP wedge + Ask**, not Product Hunt.

The single most dangerous gap: **everything has been validated on one test repo
(`abc0b187`) with ~26 decisions and synthetic data.** Nothing has met a real
engineering org. Until it has, every "it works" is "it works in the demo."

## Subsystem audit (real vs. claimed)

| Subsystem | Status | Launch impact |
|---|---|---|
| Decision Graph | **Real** — nodes, typed edges, versions, lifecycle; migration 0007 live | Core asset; solid |
| Decision API (facade) | **Real** — 14 named verbs, every client routes through it | Strong; the right architecture |
| Reasoning (citation-or-silence) | **Real + verified** — declines without evidence | Trust foundation; good |
| Context API + **MCP server** | **Real + verified** — 5 tools, hardened, install docs | The wedge; the best-positioned piece |
| Planning Engine | **Real + verified** — deterministic intent/scope + cited plan | Good, differentiated |
| Memory Engine | **Real + verified** — durability/decay/reinforcement/health | Real moat mechanic |
| Human-review loop | **Real + verified** — proposed→approved/rejected | Makes the graph the system of record |
| ADR/doc import | **Real + verified** — but extractor flaky on single docs | Cold-start cure; needs a doc-tuned prompt |
| GitHub App (PR review + extraction) | **Real, but not live-wired** | **BLOCKER** — webhook/OAuth URLs not pointed at the deploy |
| Connectors (Linear/Notion/Slack/Jira/Confluence/Discord) | **Real clients**; light ingestion | OK; depth unproven |
| Governance / drift | **Partial** — governance report real; "drift vs code" not built | Fine for V1 |
| Dashboard / Ask / Review UI | **Real + verified**, polished | Good first impression |
| Auth / multi-tenancy | **Partial** — session auth + per-repo access; **no API keys, no SSO/RBAC/SCIM** | **BLOCKER for SaaS/enterprise** |
| Billing | **Designed only** — enum + page; no Stripe | **BLOCKER to charge** |
| Trust / Learning / Analytics / ROI "engines" | **Mostly not built** as named subsystems (trust = citation-or-silence; learning = reinforcement) | Don't claim them |
| Agent Runtime / Plugins / IDE ext / Marketplace / CLI | **Not built** | Correctly deferred (don't claim) |
| Enterprise (SSO/SAML/SCIM/self-host/SOC2/BYO-model) | **Not built** | Blocks enterprise deals only |
| Testing | **Real** — 97 tests, typecheck clean; DB-integration skipped (no test Postgres) | Good for this stage |
| Performance/scale | **Unproven** — O(n²) dup scan, traverse = N round-trips/depth, single Neon | Fine ≤ hundreds of decisions; not validated beyond |
| Ops/reliability | **Weak** — no monitoring/alerting; background services get reaped; Render small instances | Hardening needed pre-scale |

## Scores

| Dimension | Score | Why |
|---|---|---|
| Engineering quality | **8** | Clean monorepo, typed, tested, consistent patterns |
| Architecture | **8** | Graph-centric, Decision-API-mediated, swappable providers/LLM |
| Security | **4** | Secrets encrypted, per-repo access; no SSO/RBAC/API-keys/audit completeness |
| UX | **7** | Polished dashboard, Ask, Review; legible |
| Performance | **5** | Works small; unproven at scale; known O(n²)/N-round-trip spots |
| Reliability | **4** | No load testing, monitoring, or proven uptime; fragile ops |
| Differentiation | **6** | Decision graph + negative knowledge + pre-code MCP context is real & uncommon — but unproven and copyable by incumbents |
| Enterprise readiness | **2** | None of the enterprise controls exist |
| Developer experience | **6** | MCP is great; no published packages/CLI/SDK yet |
| Business model | **4** | Sound design (see pricing.md); zero implementation |
| Go-to-market | **3** | Strategy only; zero execution, zero users |

**Composite: ~5.2/10 — "strong core, unproven product."**

## Competitive truth (no flattery)

- **Real, uncommon angle:** systematically capturing *negative* knowledge
  (rejected approaches) and serving *organizational context to coding agents
  before generation* (MCP). Neither Cursor, Claude Code, Copilot, CodeRabbit,
  nor Greptile does this as a first-class, persistent graph today.
- **Honest weakness:** it's a *concept* moat, not a *data* moat — the graph is
  empty until used, so on day one we're strictly worse than tools that work
  instantly. The moat only exists after months of accumulation.
- **Existential risk:** GitHub/Cursor/Anthropic can add "project memory." Our
  defense is depth (cross-source provenance, review-curated trust, negative
  knowledge) + switching cost from an accumulated graph — none of which is proven.
- **Glean** is the closest threat (enterprise knowledge search); our wedge is
  being *engineering-native and agent-facing*, not a search box.

## Launch checklist

**Critical blockers (cannot launch to real users without):**
1. **Wire the live loop** — point GitHub App webhook + OAuth callback at the deploy *(user-only)*.
2. **Tenant auth for the API surface** — API keys/tokens for MCP-as-a-service + verified per-org isolation. Today it's session-gated and effectively single-tenant.
3. **Cold-start quality** — a doc-tuned extraction prompt so import reliably yields decisions (the "wow").
4. **At least 3 real repos onboarded** end-to-end before claiming it works.

**High:** billing (Stripe) to charge; basic monitoring/alerting + error reporting; rate-limit/abuse review; data-deletion/export path.

**Medium:** drift-vs-code; CLI; memory-health UI depth; Slack bot.

**Nice-to-have / future:** analytics, ROI, SSO/SCIM, marketplace, IDE extension, multi-agent.

## Launch plan (the honest one)

1. **Private beta, 5–20 design partners** (teams already on Cursor/Claude Code).
   Onboard via MCP + import their ADRs/docs. Goal: prove time-to-value and that
   the graph compounds. Generate ROI by hand.
2. Instrument activation (repo connected → first cited answer → returning use).
3. Only after 5+ partners show weekly use + retention: public beta + the wedge
   content push. **Do not raise/announce on the strength of the demo.**

## First 100 & investor angle (brief)

- **First 100:** bottom-up — free MCP install for Cursor/Claude Code users + OSS
  maintainers; the import flow as the hook ("see your architecture in 5 min").
- **Investor one-liner:** *the context layer every coding agent calls before it
  writes code.* The proof they'll want — and we don't have yet — is **retention
  and graph growth per org over weeks**. Lead with the wedge + a design-partner
  case study, not the feature list.

## Top risks → mitigation
1. **No users / unproven adoption** → design-partner beta now; instrument activation.
2. **Cold-start empty graph** → import + auto-edges (built); doc-tuned extractor (todo).
3. **Incumbent fast-follow** → race on accumulated-graph depth + agent integration; don't out-feature, out-specialize.
4. **Ops fragility** → monitoring + a real always-on host before scale.
5. **Founder over-building** → the roadmap audit already flagged this; keep cutting.

## Bottom line
Ship a **narrow beta**, not a launch. The engineering is ready enough; the
*proof* is not. The next milestone isn't a feature — it's **the first real team
that uses Company Brain every week**.

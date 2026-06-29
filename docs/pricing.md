# Company Brain — Pricing & Packaging

> Status: **design spec** (pre-launch, pre-revenue). This defines the packaging
> decisions; it is *not* a commitment to build all of it now. See "What to build
> now" at the end — most of this is deliberately deferred until there is demand.

## Guiding principle — "If Stripe, GitHub & Linear built this"

- **GitHub:** a genuinely generous free tier for individuals + OSS is the growth
  engine. You pay for *collaboration, governance, and control* — not for the core.
- **Stripe:** value-aligned and transparent. Never meter the thing the user
  can't predict (tokens/prompts). Great docs/DX are part of the product.
- **Linear:** few, opinionated tiers. No nickel-and-diming. Per-seat for teams.
  Annual discount. Beautiful, legible pricing page.

**Synthesis → 4 tiers, not 5.** Collapse the proposed Individual/Pro/Team/
Business/Enterprise into **Free · Pro · Team · Enterprise**. Five tiers is
decision-friction; Linear-style simplicity wins. "Business" becomes a couple of
Team add-ons + the bottom of Enterprise.

**The most important divergence from the brief:** the brief makes *Individual* a
paid \$15–20 tier. That breaks the wedge. Our entire GTM is bottom-up: every
Cursor / Claude Code user installs the **MCP server for free** and the graph
compounds. The free tier *is* the distribution. So the entry tier is **Free**,
and it must be lovable, not crippled.

## The economic insight that shapes everything

Our marginal cost per user is **cents/month**, not dollars. From the real cost
model: a reasoned answer / PR check on Gemini Flash is ~\$0.002; embeddings are
negligible; infra floor is ~\$25–45/mo *total* (Render 2×\$7, Neon, domain) and
scales sub-linearly. So:

- Value-based pricing yields **>90% gross margin** at every paid tier.
- We can afford a generous free tier (the moat is the accumulating graph, not
  compute) and still print money on Pro/Team.
- Therefore: **never meter tokens/prompts/context.** Meter *organizations,
  collaboration, governance, and control* — the things that scale with value.

## Tiers (mapped to features that exist today vs. roadmap)

Legend: **[live]** shipped & verified · **[soon]** built, needs polish/UI ·
**[roadmap]** not built yet — do not sell as available.

### Free — "create love" (the wedge)
Target: solo devs, students, vibe coders, OSS, anyone evaluating.
- 1 repository, 1 personal org
- **MCP server** (what_applies_here / can_i / ask / plan / get_rejected) **[live]**
- **Ask Company Brain** UI **[live]**, Decision/Architecture search **[live]**
- Decision Graph + Memory (read + basic) **[live]**
- Planning Engine **[live]**, Context API **[live]**
- GitHub App: PR review + knowledge extraction **[live]**
- Fair-use reasoning cap (generous; soft-limited, never token-metered)
- Price: **\$0 forever.**

### Pro — "create addiction" (individual power user)
Target: professional devs, consultants, freelancers.
- Everything in Free, **unlimited repositories**
- Unlimited reasoning/planning (fair use)
- Memory **health** + reinforcement insights **[live]**
- Governance report (stale/orphaned/conflicts) **[live]**
- Priority indexing & processing **[roadmap: queue priority]**
- Drift / technical-debt analysis **[roadmap]**
- Price: **\$20/mo** (annual \$16/mo). *(Lower than the brief's \$39–49 — anchor
  for adoption; raise later from strength, never punish early believers.)*

### Team — "create collaboration" (per-seat)
Target: startups, agencies, engineering teams.
- Everything in Pro, **shared Organization Brain** (shared graph + memory) **[live core]**
- Connectors: Linear / Notion / Slack / Jira / Confluence / Discord **[live]**
- Roles & permissions **[live: memberships/roles]**, shared dashboards **[live]**
- Architecture governance + engineering reports **[soon/roadmap]**
- Audit log **[live: audit service]**
- Price: **\$30/user/mo** (annual \$24). Minimum is irrelevant — let one dev
  start free and pull the team in.

### Enterprise — "become infrastructure"
Target: large orgs, regulated industries.
- Everything in Team, plus **control & assurance**:
- SSO / SAML / SCIM, fine-grained RBAC **[roadmap]**
- Self-hosted / air-gapped / private cloud **[roadmap]**
- Bring-your-own-model / private LLM (provider abstraction exists) **[soon]**
- SOC 2, security review, SLA, dedicated CSM, migration/training **[roadmap]**
- Price: **custom, \$25k–\$250k+/yr** by org size. *(The brief's \$1M is a
  later-stage anchor; don't lead with it.)*

## Free forever / never paywalled
- The **MCP server** and the **Ask/Context** core. This is the wedge and the
  trust-builder; paywalling it kills bottom-up adoption.
- **Honest "I don't know" / citation-or-silence.** Trust is never a paid feature.
- Reading your *own* recorded decisions.
- OSS public repos (verified maintainers get Team-level free).

## Enterprise-only (justified gating)
Only gate things whose value is *organizational control & assurance*, never core
intelligence: SSO/SAML/SCIM, RBAC, self-host/air-gap, BYO-model, compliance
attestations, SLAs, dedicated support. Gating these is fair — they cost us real
money and only large orgs need them.

## Programs
- **Open source:** verified maintainers → Team free on public repos.
- **Students/educators:** Pro free with .edu / GitHub Student verification.
- **Startups (<2 yrs, <\$5M raised):** 1 year Team free, then 50% for year 2.

## Conversion & retention
- Upgrade path Free→Pro→Team→Enterprise, **always value-pulled, never blocked
  mid-task.** When a soft cap is hit, show the value created, not a wall.
- **Renewal = the ROI report** (decisions captured, conflicts caught pre-merge,
  duplicate work avoided, onboarding time saved). *[roadmap: ROI engine]* — until
  it exists, generate this manually for the first design partners.

## Unit economics (honest, pre-revenue — assumptions, not projections)
- **Gross margin:** ~90–95% on Pro/Team (AI cost ≈ \$0.05–\$0.50/user/mo at
  realistic usage; infra amortizes to near-zero per user).
- **CAC:** bottom-up PLG (MCP install, content, OSS) → low CAC; the MCP wedge is
  the cheapest acquisition channel we have.
- **LTV:** switching cost compounds with the graph — the longer used, the harder
  to leave (the moat). Expect NRR > 100% as repos/seats grow.
- I'm **not** fabricating an MRR curve: zero customers means any projection is
  fiction. The shape above is what to instrument once design partners exist.

## What to build now (and what NOT to)
**Now (cheap, high-leverage):**
1. This doc + a static **pricing page** on the marketing site (Free/Pro/Team/
   Enterprise, comparison table, FAQ).
2. Nothing else billing-wise until a paying motion exists.

**Defer until demand (premature today):**
- Stripe integration, metered add-ons, marketplace revenue share, ROI engine,
  drift/analytics dashboards, SSO/SCIM, self-host. The current `org_plan`
  (free/pro/enterprise) enum + billing page is enough scaffolding to demo; align
  it to the 4-tier model only when the first customer is ready to pay.

**The one pricing decision that matters pre-launch:** keep the **MCP + Ask core
free forever**. Everything else can be tuned later from a position of strength.

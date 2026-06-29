# Company Brain — Candidate Features & Audit

> 22 candidate feature prompts, each audited against the **feature filter**
> (Constitution VII/XLVII/XLIX): *Would a customer pay? Used weekly? Strengthens
> the moat? Would removing it hurt? What does it depend on (credentials/infra)?*
> Verdicts: **NOW** (next build) · **NEXT** (after the NOW set) · **LATER** (post-PMF)
> · **RESIST** (don't build / fold in). Effort: S/M/L.

## The candidates

### A — Close the loop on what's already built
1. **Reviewer → reasoning engine.** Route `checkPr` through `reason()` so the PR reviewer and Ask share one cited pipeline.
2. **Auto-populate edges & scope on extraction.** Emit `supersedes`/`affects`/service tags so the graph is a real graph, not islands.
3. **Memory-health UI strip** on `/app/memory` (API already live).
4. **Citation-based reinforcement.** Wire the existing `referenced` kind so cited decisions strengthen (bounded).
5. **Conflict auto-detection.** pgvector + LLM judge to create `contradicts` edges → feeds governance/health.

### B — Distribution & adoption (the wedge)
6. **VS Code / Cursor extension** — thin client over Context API/MCP (inline constraints while typing).
7. **CLI** (`brain ask/plan/can-i/context`) — thin client; scriptable, CI-friendly.
8. **Slack bot** — ask the brain in Slack; capture decisions from threads.
9. **Onboarding wizard / first-run "wow"** — connect repo → first cited insight in minutes.
10. **Public shareable decision pages** — read-only graph snapshots (viral loop, OSS).

### C — Proactive intelligence (CTO value)
11. **Architecture drift detection** — current code vs recorded decisions.
12. **Engineering analytics / CTO dashboard** — health scores, knowledge concentration.
13. **ROI engine** — value report (conflicts caught, dup work avoided) for renewals.
14. **Decision digest** — weekly email + in-app notifications on changes/stale/conflicts.
15. **Engineering time machine** — timeline UI over `decision_versions` (already stored).
16. **ADR / RFC / doc bulk import** — turn existing markdown/Notion/Confluence into seed decisions.

### D — Platform & enterprise (gated)
17. **Context API public auth** — API keys + rate limits → a real external product surface.
18. **Outbound webhooks / events** — `DecisionCreated/Updated/Conflict` for automation.
19. **Enterprise auth** — SSO/SAML/SCIM/RBAC.
20. **Connector marketplace / SDK** — third-party connectors.
21. **Multi-agent orchestration** — planner/researcher/judge agents.
22. **Self-host / BYO-model packaging** — air-gapped, private LLM.

## Audit

| # | Feature | Verdict | Effort | Why / dependency |
|---|---------|---------|--------|------------------|
| 16 | ADR/doc import | **NOW** | M | Solves the #1 risk: a cold, empty graph. Fastest path to time-to-value. Connectors exist; add a doc→decision extractor. |
| 2 | Auto edges & scope | **NOW** | M | Biggest *moat* gap — without edges it's a list, not a graph. Multi-hop reasoning depends on this. |
| 3 | Memory-health UI | **NOW** | S | API done; makes the moat visible. Cheap. |
| 4 | Citation reinforcement | **NOW** | S | `referenced` already exists; wire it (bounded). Compounds the moat per use. |
| 1 | Reviewer → reasoning | **NEXT** | M | Removes the last dual-path debt; unifies citations. Not user-visible, so after the value-adds. |
| 5 | Conflict auto-detect | **NEXT** | M | Strong "delight" signal ("these decisions conflict"); feeds governance. |
| 7 | CLI | **NEXT** | M | Thin client, high power-user love, scriptable. Pure DX. |
| 9 | Onboarding wizard | **NEXT** | M | Activation drives every other metric. Pairs with #16. |
| 14 | Decision digest | **NEXT** | M | Creates the weekly habit (retention). Needs email infra (creds). |
| 8 | Slack bot | **LATER** | M | High value but **needs Slack app creds + hosting**; do after CLI proves the thin-client pattern. |
| 6 | IDE extension | **LATER** | L | The dream surface, but MCP already covers Cursor/Claude Code; extension is a big lift + marketplace publishing. |
| 11 | Drift detection | **LATER** | L | Needs code-state ingestion at scale; high value but heavy. |
| 15 | Time machine UI | **LATER** | M | Data (`decision_versions`) is there; UI is post-PMF polish. |
| 10 | Public decision pages | **LATER** | M | Viral loop, but needs sharing/permissions model — defer until there's a graph worth sharing. |
| 17 | Context API auth | **LATER** | M | Only when external developers actually want to integrate. |
| 18 | Webhooks/events | **LATER** | M | Same — wait for ecosystem demand. |
| 12 | Analytics dashboard | **RESIST (now)** | L | Needs usage data we don't have. Premature. |
| 13 | ROI engine | **RESIST (now)** | M | Same — fabricating ROI pre-usage erodes trust. Generate manually for first design partners. |
| 19 | Enterprise SSO/RBAC | **RESIST (now)** | L | Zero enterprise customers. Build when one is in procurement (creds/IdP needed). |
| 20 | Connector marketplace | **RESIST** | L | Classic premature-platform trap. Need connectors people want first. |
| 21 | Multi-agent | **RESIST** | L | Orchestration complexity without customer pull. Fold gains into the single reasoning pipeline instead. |
| 22 | Self-host / BYO-model | **RESIST (now)** | L | Enterprise sales-gated; provider abstraction already exists for when it's real. |

## Synthesis

**The one theme that matters next: kill the cold-start.** The platform's biggest
risk isn't missing features — it's an **empty graph** on day one. So the NOW set
is chosen to make a graph *populated and connected* fast:

- **#16 ADR/doc import** (seed the graph) + **#2 auto-edges** (connect it) +
  **#3 memory-health UI** + **#4 citation reinforcement** (make it visibly
  compound). That's ~1 focused cycle and it directly attacks time-to-value.

**Then** the adoption/retention layer (#1, #5, #7, #9, #14).

**Explicitly do NOT build now:** analytics, ROI, enterprise SSO, marketplace,
multi-agent, self-host (#12,13,19,20,21,22). All are premature with zero
customers; several need credentials/infra/sales motions that don't exist yet.

**Credential/infra-blocked (not us):** Slack bot, IDE-extension publishing,
enterprise SSO, email for digests, all deployment.

**Removed-and-nobody-cares test:** of the 22, only ~9 pass it today (the NOW+NEXT
sets). The other 13 are real someday — but building them now is the feature-bloat
the Constitution exists to prevent.

import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const API = "https://api.pagerduty.com";
/** PagerDuty requires this Accept header to pin the REST API version. */
const ACCEPT = "application/vnd.pagerduty+json;version=2";
/** Notes are fetched per incident; keep concurrency well under the 900 req/min limit. */
const NOTE_CONCURRENCY = 4;

interface PdIncident {
  id: string;
  incident_number: number;
  title: string;
  description?: string | null;
  status: string;
  urgency?: string | null;
  html_url: string;
  created_at?: string | null;
  resolved_at?: string | null;
  service?: { summary?: string | null } | null;
}

interface PdNote {
  content: string;
  created_at?: string | null;
}

/**
 * PagerDuty connector — the incident half of the decision graph.
 *
 * Reads resolved incidents and, crucially, their notes: the postmortem reasoning
 * ("root cause was the retry storm, we're banning unbounded retries") is what makes
 * an incident citable. A decision derived from an incident is the strongest kind of
 * block — it can name the outage that produced the rule.
 *
 * Auth is a PagerDuty REST API key sent as `Authorization: Token token=…`. Read-only:
 * this connector never acknowledges, resolves, or otherwise mutates an incident.
 */
export class PagerDutyConnector implements ConnectorClient {
  readonly type = "pagerduty" as const;
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return { authorization: `Token token=${this.token}`, accept: ACCEPT };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { headers: this.headers() });
    if (!res.ok) {
      // 401 here is nearly always a wrong/expired key — say so rather than leaking the body.
      if (res.status === 401) throw new Error("PagerDuty 401: API key rejected — check the key and its scope.");
      throw new Error(`PagerDuty ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** Notes carry the postmortem reasoning; an incident without them is just a title. */
  private async fetchNotes(incidentId: string): Promise<string> {
    try {
      const json = await this.get<{ notes?: PdNote[] }>(`/incidents/${encodeURIComponent(incidentId)}/notes`);
      return (json.notes ?? [])
        .map((n) => n.content?.trim())
        .filter((c): c is string => !!c)
        .join("\n");
    } catch {
      return ""; // one unreadable note set must not sink the whole sync
    }
  }

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const limit = Math.min(config.limit ?? 50, 100);
    const params = new URLSearchParams({
      limit: String(limit),
      sort_by: "created_at:desc",
      "statuses[]": "resolved",
    });
    // Scope to specific services when configured; otherwise every service the key can see.
    for (const id of config.serviceIds ?? []) params.append("service_ids[]", id);
    if (config.since) params.set("since", config.since);

    const json = await this.get<{ incidents?: PdIncident[] }>(`/incidents?${params.toString()}`);
    const incidents = json.incidents ?? [];

    // Bounded-concurrency note fetch — a worker pool, not Promise.all over 100 incidents.
    const notes = new Array<string>(incidents.length).fill("");
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(NOTE_CONCURRENCY, incidents.length) }, async () => {
        for (;;) {
          const i = cursor++;
          if (i >= incidents.length) return;
          notes[i] = await this.fetchNotes(incidents[i]!.id);
        }
      }),
    );

    return incidents.map((inc, i) => {
      const service = inc.service?.summary?.trim();
      const meta = [
        service ? `Service: ${service}` : null,
        inc.urgency ? `Urgency: ${inc.urgency}` : null,
        inc.resolved_at ? `Resolved: ${inc.resolved_at}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const content = [meta, inc.description?.trim() || null, notes[i] || null].filter(Boolean).join("\n\n");
      return {
        id: `PD-${inc.incident_number}`,
        title: `Incident #${inc.incident_number}: ${inc.title}`,
        content,
        url: inc.html_url,
      };
    });
  }
}

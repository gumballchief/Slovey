import { afterEach, describe, expect, it, vi } from "vitest";
import { PagerDutyConnector, getConnectorClient, isConnectorType } from "../src/connectors";

afterEach(() => vi.restoreAllMocks());

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const INCIDENT = {
  id: "PABCDEF",
  incident_number: 42,
  title: "Checkout latency spike",
  description: "p99 crossed 4s for 18 minutes.",
  status: "resolved",
  urgency: "high",
  html_url: "https://acme.pagerduty.com/incidents/PABCDEF",
  resolved_at: "2026-07-20T11:04:00Z",
  service: { summary: "Checkout API" },
};

/** Route a mocked fetch by URL so incident and note calls can differ. */
function mockApi(handlers: { incidents?: unknown; notes?: unknown; noteStatus?: number }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/notes")) return json(handlers.notes ?? { notes: [] }, handlers.noteStatus ?? 200);
    return json(handlers.incidents ?? { incidents: [] });
  });
}

describe("connector factory (pagerduty)", () => {
  it("knows the type and maps it to a client", () => {
    expect(isConnectorType("pagerduty")).toBe(true);
    expect(getConnectorClient("pagerduty", "t").type).toBe("pagerduty");
  });
});

describe("PagerDutyConnector", () => {
  it("folds incident metadata, description and postmortem notes into one citable doc", async () => {
    mockApi({
      incidents: { incidents: [INCIDENT] },
      notes: { notes: [{ content: "Root cause: unbounded retry storm." }, { content: "Action: ban retries without a ceiling." }] },
    });

    const docs = await new PagerDutyConnector("key").fetchDocs();
    expect(docs).toHaveLength(1);
    const doc = docs[0]!;
    expect(doc.id).toBe("PD-42");
    expect(doc.title).toBe("Incident #42: Checkout latency spike");
    expect(doc.url).toBe(INCIDENT.html_url);
    // The postmortem reasoning is the whole point — it must survive into content.
    expect(doc.content).toContain("Root cause: unbounded retry storm.");
    expect(doc.content).toContain("ban retries without a ceiling");
    expect(doc.content).toContain("Service: Checkout API");
    expect(doc.content).toContain("p99 crossed 4s");
  });

  it("only asks for resolved incidents and honours serviceIds, since and limit", async () => {
    const spy = mockApi({ incidents: { incidents: [] } });
    await new PagerDutyConnector("key").fetchDocs({
      serviceIds: ["PSVC1", "PSVC2"],
      since: "2026-01-01T00:00:00Z",
      limit: 7,
    });

    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain("statuses%5B%5D=resolved");
    expect(url).toContain("service_ids%5B%5D=PSVC1");
    expect(url).toContain("service_ids%5B%5D=PSVC2");
    expect(url).toContain("since=2026-01-01T00%3A00%3A00Z");
    expect(url).toContain("limit=7");
  });

  it("caps limit at 100 so a bad config can't request an unbounded page", async () => {
    const spy = mockApi({ incidents: { incidents: [] } });
    await new PagerDutyConnector("key").fetchDocs({ limit: 5000 });
    expect(String(spy.mock.calls[0]![0])).toContain("limit=100");
  });

  it("sends the versioned Accept header and token auth", async () => {
    const spy = mockApi({ incidents: { incidents: [] } });
    await new PagerDutyConnector("secret-key").fetchDocs();
    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Token token=secret-key");
    expect(headers.accept).toBe("application/vnd.pagerduty+json;version=2");
  });

  it("survives unreadable notes instead of failing the whole sync", async () => {
    mockApi({ incidents: { incidents: [INCIDENT] }, notes: { error: "nope" }, noteStatus: 403 });
    const docs = await new PagerDutyConnector("key").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.content).toContain("p99 crossed 4s"); // description still made it
  });

  it("gives a clear message on a rejected key and never echoes the response body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ error: { message: "Account not found", secret: "do-not-leak" } }, 401),
    );
    await expect(new PagerDutyConnector("bad").fetchDocs()).rejects.toThrow(/API key rejected/);
    await expect(new PagerDutyConnector("bad").fetchDocs()).rejects.not.toThrow(/do-not-leak/);
  });

  it("returns an empty list when PagerDuty reports no incidents", async () => {
    mockApi({ incidents: {} });
    await expect(new PagerDutyConnector("key").fetchDocs()).resolves.toEqual([]);
  });
});

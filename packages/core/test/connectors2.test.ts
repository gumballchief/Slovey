import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfluenceConnector,
  DiscordConnector,
  JiraConnector,
  getConnectorClient,
  isConnectorType,
} from "../src/connectors";

afterEach(() => vi.restoreAllMocks());

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("connector factory (extended)", () => {
  it("knows the new types and maps them to clients", () => {
    expect(isConnectorType("jira")).toBe(true);
    expect(isConnectorType("confluence")).toBe(true);
    expect(isConnectorType("discord")).toBe(true);
    expect(getConnectorClient("jira", "t").type).toBe("jira");
    expect(getConnectorClient("confluence", "t").type).toBe("confluence");
    expect(getConnectorClient("discord", "t").type).toBe("discord");
  });
});

describe("JiraConnector", () => {
  it("requires baseUrl + email", async () => {
    await expect(new JiraConnector("tok").fetchDocs({})).rejects.toThrow(/site URL and account email/);
  });

  it("flattens ADF description + comments into a citable doc", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        issues: [
          {
            key: "ENG-1",
            fields: {
              summary: "Use Postgres",
              description: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "We chose Postgres." }] }],
              },
              comment: { comments: [{ body: { type: "doc", content: [{ type: "text", text: "agreed" }] } }] },
            },
          },
        ],
      }),
    );
    const docs = await new JiraConnector("tok").fetchDocs({
      baseUrl: "https://acme.atlassian.net",
      email: "you@acme.com",
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("ENG-1 Use Postgres");
    expect(docs[0]!.content).toContain("We chose Postgres.");
    expect(docs[0]!.content).toContain("agreed");
    expect(docs[0]!.url).toBe("https://acme.atlassian.net/browse/ENG-1");
  });
});

describe("ConfluenceConnector", () => {
  it("strips HTML from page bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        results: [
          {
            id: "p1",
            title: "RFC: Caching",
            body: { storage: { value: "<p>Use <strong>Redis</strong>&nbsp;cache.</p>" } },
            _links: { webui: "/spaces/X/pages/p1" },
          },
        ],
      }),
    );
    const docs = await new ConfluenceConnector("tok").fetchDocs({
      baseUrl: "https://acme.atlassian.net",
      email: "you@acme.com",
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("RFC: Caching");
    expect(docs[0]!.content).toBe("Use Redis cache.");
    expect(docs[0]!.url).toBe("https://acme.atlassian.net/wiki/spaces/X/pages/p1");
  });
});

describe("DiscordConnector", () => {
  it("requires channel IDs", async () => {
    await expect(new DiscordConnector("tok").fetchDocs({})).rejects.toThrow(/channel ID/);
  });

  it("reads channel messages into one doc per channel", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/messages")) {
        return json([{ content: "We decided to ship daily." }, { content: "" }]);
      }
      return json({ name: "eng" });
    });
    const docs = await new DiscordConnector("tok").fetchDocs({ channels: ["123"] });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("#eng");
    expect(docs[0]!.content).toBe("We decided to ship daily.");
  });
});

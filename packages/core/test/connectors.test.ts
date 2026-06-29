import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret } from "../src/crypto";
import {
  getConnectorClient,
  isConnectorType,
  LinearConnector,
  NotionConnector,
  SlackConnector,
} from "../src/connectors";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => vi.restoreAllMocks());

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("crypto (token at rest)", () => {
  it("round-trips a secret", () => {
    const secret = "lin_api_supersecret";
    const blob = encryptSecret(secret);
    expect(blob).not.toContain(secret);
    expect(decryptSecret(blob)).toBe(secret);
  });

  it("fails to decrypt if the ciphertext is tampered (GCM auth)", () => {
    const blob = encryptSecret("hello");
    const [iv, tag, ct] = blob.split(".");
    const tampered = [iv, tag, Buffer.from("zzzz").toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks for display without leaking the secret", () => {
    expect(maskSecret("xoxb-123456")).toBe("••••3456");
  });
});

describe("getConnectorClient", () => {
  it("maps types to clients and validates types", () => {
    expect(getConnectorClient("linear", "t").type).toBe("linear");
    expect(getConnectorClient("notion", "t").type).toBe("notion");
    expect(getConnectorClient("slack", "t").type).toBe("slack");
    expect(isConnectorType("linear")).toBe(true);
    expect(isConnectorType("meetings")).toBe(false);
  });
});

describe("LinearConnector", () => {
  it("turns issues (+comments) into citable docs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        data: {
          issues: {
            nodes: [
              {
                identifier: "ENG-12",
                title: "Drop Redis",
                description: "We will not use Redis.",
                url: "https://linear.app/acme/issue/ENG-12",
                comments: { nodes: [{ body: "pg-boss instead" }] },
              },
            ],
          },
        },
      }),
    );
    const docs = await new LinearConnector("tok").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("ENG-12 Drop Redis");
    expect(docs[0]!.content).toContain("We will not use Redis.");
    expect(docs[0]!.content).toContain("pg-boss instead");
    expect(docs[0]!.url).toBe("https://linear.app/acme/issue/ENG-12");
  });

  it("surfaces GraphQL errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ errors: [{ message: "bad token" }] }));
    await expect(new LinearConnector("tok").fetchDocs()).rejects.toThrow(/bad token/);
  });
});

describe("NotionConnector", () => {
  it("reads page titles and block text", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/search")) {
        return json({
          results: [
            {
              id: "page1",
              url: "https://notion.so/page1",
              properties: { Name: { type: "title", title: [{ plain_text: "RFC: Auth" }] } },
            },
          ],
        });
      }
      return json({
        results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Use OAuth." }] } }],
      });
    });
    const docs = await new NotionConnector("tok").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("RFC: Auth");
    expect(docs[0]!.content).toContain("Use OAuth.");
    expect(docs[0]!.url).toBe("https://notion.so/page1");
  });
});

describe("SlackConnector", () => {
  it("collects channel messages, skipping join/system messages", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("conversations.list")) {
        return json({ ok: true, channels: [{ id: "C1", name: "eng" }] });
      }
      return json({
        ok: true,
        messages: [
          { text: "We decided to ship daily." },
          { text: "joined", subtype: "channel_join" },
        ],
      });
    });
    const docs = await new SlackConnector("tok").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("#eng");
    expect(docs[0]!.content).toBe("We decided to ship daily.");
  });

  it("throws on a Slack API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ ok: false, error: "invalid_auth" }));
    await expect(new SlackConnector("tok").fetchDocs()).rejects.toThrow(/invalid_auth/);
  });
});

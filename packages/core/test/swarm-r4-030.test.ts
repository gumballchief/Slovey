import { describe, it, expect, vi, afterEach } from "vitest";
import { JiraConnector } from "../src/connectors/jira";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JiraConnector baseUrl validation (R4-030)", () => {
  it("does not send the Atlassian credential to an attacker-controlled host", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ issues: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new JiraConnector("secret-token");
    await expect(
      client.fetchDocs({ baseUrl: "https://attacker.example", email: "victim@acme.com" }),
    ).rejects.toThrow("https://*.atlassian.net");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects http, lookalike hosts, credentials, and non-443 ports without fetching", async () => {
    const bad = [
      "http://acme.atlassian.net",
      "https://acme.atlassian.net.evil.com",
      "https://user:pass@acme.atlassian.net",
      "https://acme.atlassian.net:8080",
      "http://169.254.169.254",
    ];
    for (const baseUrl of bad) {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ issues: [] }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      const client = new JiraConnector("secret-token");
      await expect(client.fetchDocs({ baseUrl, email: "a@b.com" })).rejects.toThrow(
        "https://*.atlassian.net",
      );
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("allows a valid atlassian.net origin with redirect:error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ issues: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new JiraConnector("secret-token");
    await client.fetchDocs({ baseUrl: "https://acme.atlassian.net/", email: "a@b.com" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith("https://acme.atlassian.net/rest/api/3/search")).toBe(true);
    expect(init?.redirect).toBe("error");
  });
});

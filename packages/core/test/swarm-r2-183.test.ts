import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfluenceConnector } from "../src/connectors/confluence";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetch() {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      results: [{ id: "1", title: "RFC", body: { storage: { value: "<p>hi</p>" } }, _links: { webui: "/pages/1" } }],
    }),
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("Confluence SSRF guard", () => {
  it.each([
    "http://localhost:3000",
    "http://169.254.169.254",
    "http://10.0.0.1:8080",
    "https://169.254.169.254",
    "https://evil.example.com",
    "https://acme.atlassian.net.evil.example.com",
    "https://evil-atlassian.net",
    "http://acme.atlassian.net",
    "https://user:pass@acme.atlassian.net",
    "not a url",
  ])("rejects unsafe baseUrl %s without fetching", async (baseUrl) => {
    const fetchFn = mockFetch();
    const connector = new ConfluenceConnector("token");
    await expect(connector.fetchDocs({ baseUrl, email: "a@example.com" })).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("allows https://*.atlassian.net with no redirects and a timeout", async () => {
    const fetchFn = mockFetch();
    const connector = new ConfluenceConnector("token");
    const docs = await connector.fetchDocs({ baseUrl: "https://acme.atlassian.net/", email: "a@example.com" });
    expect(docs).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain("https://acme.atlassian.net/wiki/rest/api/content");
    expect(call[1].redirect).toBe("error");
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });
});

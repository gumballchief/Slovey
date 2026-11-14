import { afterEach, describe, expect, it, vi } from "vitest";
import { JiraConnector } from "../src/connectors/jira";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JiraConnector SSRF protection", () => {
  it("rejects non-Atlassian and internal base URLs without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const connector = new JiraConnector("token");
    for (const baseUrl of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:8080/admin",
      "https://10.0.0.1/",
      "https://example.com/",
      "http://acme.atlassian.net/",
    ]) {
      await expect(
        connector.fetchDocs({ baseUrl, email: "user@example.com" }),
      ).rejects.toThrow("atlassian.net");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak the response body and does not follow redirects", async () => {
    const secret = "SECRET_INTERNAL_RESPONSE_BODY";
    let seenInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenInit = init;
      return {
        ok: false,
        status: 500,
        text: async () => secret,
        json: async () => ({}),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = new JiraConnector("token");
    let message = "";
    try {
      await connector.fetchDocs({
        baseUrl: "https://acme.atlassian.net",
        email: "user@example.com",
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("500");
    expect(message).not.toContain(secret);
    expect(seenInit?.redirect).toBe("error");
  });
});

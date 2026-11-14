import { describe, it, expect, vi, afterEach } from "vitest";
import { JiraConnector } from "../src/connectors/jira";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JiraConnector search endpoint", () => {
  it("uses POST /rest/api/3/search/jql with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issues: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new JiraConnector("tok");
    await client.fetchDocs({ baseUrl: "https://acme.atlassian.net", email: "a@b.co" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://acme.atlassian.net/rest/api/3/search/jql");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as {
      jql: string;
      maxResults: number;
      fields: string[];
    };
    expect(body.jql).toBe("order by updated DESC");
    expect(body.maxResults).toBe(50);
    expect(body.fields).toEqual(["summary", "description", "comment"]);
  });
});

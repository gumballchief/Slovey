import { describe, it, expect, vi, afterEach } from "vitest";
import { NotionConnector } from "../src/connectors/notion";

function para(text: string): Record<string, unknown> {
  return { type: "paragraph", paragraph: { rich_text: [{ plain_text: text }] } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotionConnector block pagination (R6-139)", () => {
  it("concatenates blocks across paginated block-children responses", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/search")) {
        return {
          ok: true,
          json: async () => ({
            results: [{ id: "page-1", url: "https://notion.so/page-1", properties: {} }],
          }),
        };
      }
      if (u.includes("start_cursor=cursor-1")) {
        return {
          ok: true,
          json: async () => ({
            results: [para("second-hundred")],
            has_more: false,
            next_cursor: null,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          results: [para("first-hundred")],
          has_more: true,
          next_cursor: "cursor-1",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const docs = await new NotionConnector("tok").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("first-hundred");
    expect(docs[0].content).toContain("second-hundred");
  });
});

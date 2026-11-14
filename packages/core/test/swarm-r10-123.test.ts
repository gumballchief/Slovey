import { describe, it, expect, vi, afterEach } from "vitest";
import { NotionConnector } from "../src/connectors/notion";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notion nested and non-rich_text blocks", () => {
  it("includes toggle children, table_row cells and child_page titles", async () => {
    const topBlocks = [
      {
        id: "b-para",
        type: "paragraph",
        has_children: false,
        paragraph: { rich_text: [{ plain_text: "Top level" }] },
      },
      {
        id: "b-toggle",
        type: "toggle",
        has_children: true,
        toggle: { rich_text: [{ plain_text: "Toggle header" }] },
      },
      {
        id: "b-row",
        type: "table_row",
        has_children: false,
        table_row: {
          cells: [[{ plain_text: "a1" }], [{ plain_text: "b1" }]],
        },
      },
      {
        id: "b-child",
        type: "child_page",
        has_children: false,
        child_page: { title: "Nested RFC" },
      },
    ];
    const toggleChildren = [
      {
        id: "b-nested",
        type: "paragraph",
        has_children: false,
        paragraph: { rich_text: [{ plain_text: "Hidden rationale" }] },
      },
    ];
    vi.stubGlobal(
      "fetch",
      async (input: string | URL | Request): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/search")) {
          return jsonResponse({
            results: [
              {
                id: "page-1",
                url: "https://notion.so/page-1",
                properties: {
                  Name: { type: "title", title: [{ plain_text: "RFC" }] },
                },
              },
            ],
          });
        }
        if (url.includes("/blocks/b-toggle/children")) {
          return jsonResponse({ results: toggleChildren, has_more: false });
        }
        if (url.includes("/blocks/page-1/children")) {
          return jsonResponse({ results: topBlocks, has_more: false });
        }
        return jsonResponse({ results: [], has_more: false });
      },
    );
    const docs = await new NotionConnector("tok").fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("Top level");
    expect(docs[0].content).toContain("Hidden rationale");
    expect(docs[0].content).toContain("a1");
    expect(docs[0].content).toContain("b1");
    expect(docs[0].content).toContain("Nested RFC");
  });
});

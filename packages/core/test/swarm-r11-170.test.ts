import { describe, it, expect, vi, afterEach } from "vitest";
import { NotionConnector } from "../src/connectors/notion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotionConnector MAX_BLOCKS_PER_DOC budget", () => {
  it("stops paginating once the 500-block cap is reached", async () => {
    const totalPages = 10;
    const pageSize = 100;
    let childrenCalls = 0;
    const page = {
      id: "page-1",
      url: "https://notion.so/page-1",
      properties: {
        Name: { type: "title", title: [{ plain_text: "Poison" }] },
      },
    };
    vi.stubGlobal(
      "fetch",
      async (input: string) => {
        const url = String(input);
        if (url.endsWith("/search")) {
          return {
            ok: true,
            json: async () => ({ results: [page] }),
            text: async () => "",
          };
        }
        childrenCalls += 1;
        const n = childrenCalls;
        return {
          ok: true,
          json: async () => ({
            results: Array.from({ length: pageSize }, (_v, i) => ({
              id: `b-${n}-${i}`,
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: `block ${n}-${i}` }] },
              has_children: false,
            })),
            has_more: n < totalPages,
            next_cursor: n < totalPages ? `cursor-${n}` : null,
          }),
          text: async () => "",
        };
      },
    );
    const docs = await new NotionConnector("token").fetchDocs({});
    expect(docs).toHaveLength(1);
    const lines = docs[0].content.split("\n").filter(Boolean);
    expect(childrenCalls).toBeLessThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(500);
  });
});

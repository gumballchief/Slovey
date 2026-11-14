import { describe, it, expect } from "vitest";
import { fetchDocs } from "../src/github/fetchers";

function stubOctokit(treeNodes: unknown[], blobData: { content: string; size: number }) {
  return {
    rest: {
      git: {
        getTree: async () => ({ data: { tree: treeNodes } }),
        getBlob: async () => ({ data: { ...blobData, encoding: "base64" } }),
      },
    },
  } as never;
}

describe("R3-045 fetchDocs large blob guard", () => {
  it("skips a huge docs file without decoding it", async () => {
    const decodedLen = 100 * 1024;
    const largeB64 = Buffer.from("x".repeat(decodedLen)).toString("base64");
    const octokit = stubOctokit(
      [{ type: "blob", path: "docs/big.md", sha: "abc123", size: 200 * 1024 * 1024 }],
      { content: largeB64, size: decodedLen },
    );
    const docs = await fetchDocs(octokit, "o", "r", "main");
    expect(docs).toEqual([]);
  });

  it("skips a large blob even when tree size is missing", async () => {
    const decodedLen = 100 * 1024;
    const largeB64 = Buffer.from("y".repeat(decodedLen)).toString("base64");
    const octokit = stubOctokit(
      [{ type: "blob", path: "docs/big2.md", sha: "def456" }],
      { content: largeB64, size: decodedLen },
    );
    const docs = await fetchDocs(octokit, "o", "r", "main");
    expect(docs).toEqual([]);
  });
});

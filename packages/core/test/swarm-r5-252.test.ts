import { describe, it, expect, afterEach } from "vitest";
import { setAI } from "../src/ai";
import { importDocs } from "../src/pipelines/import-docs";

describe("R5-252 zero headroom skips LLM", () => {
  afterEach(() => {
    setAI(null);
  });
  it("does not call LLM when maxNew is zero", async () => {
    let calls = 0;
    setAI({
      name: "fake",
      complete: async () => "",
      completeJSON: async <T>(): Promise<T | null> => {
        calls++;
        return null;
      },
    });
    const docs = [
      { path: "a.md", content: "hello" },
      { path: "b.md", content: "world" },
    ];
    const res = await importDocs("repo-r5-252", docs, 0, "org-r5-252");
    expect(calls).toBe(0);
    expect(res).toEqual({ docs: 2, extracted: 0, inserted: 0, updated: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("R5-086 forbidden-import python/ruby", () => {
  it("flags bare python import", () => {
    const r = architectureCheckContents(
      [{ path: "a.py", content: "import blocked_module\n" }],
      ["a.py"],
      [{ type: "forbidden-import", module: "blocked_module", reason: "banned" }],
    );
    expect(r.errors.some((e) => e.code === "arch-import")).toBe(true);
  });
  it("flags python from-import", () => {
    const r = architectureCheckContents(
      [{ path: "b.py", content: "from blocked_module import thing\n" }],
      ["b.py"],
      [{ type: "forbidden-import", module: "blocked_module", reason: "banned" }],
    );
    expect(r.errors.some((e) => e.code === "arch-import")).toBe(true);
  });
  it("flags ruby require without parens", () => {
    const r = architectureCheckContents(
      [{ path: "c.rb", content: "require 'blocked'\n" }],
      ["c.rb"],
      [{ type: "forbidden-import", module: "blocked", reason: "banned" }],
    );
    expect(r.errors.some((e) => e.code === "arch-import")).toBe(true);
  });
  it("flags ruby require_relative", () => {
    const r = architectureCheckContents(
      [{ path: "d.rb", content: "require_relative 'blocked'\n" }],
      ["d.rb"],
      [{ type: "forbidden-import", module: "blocked", reason: "banned" }],
    );
    expect(r.errors.some((e) => e.code === "arch-import")).toBe(true);
  });
});

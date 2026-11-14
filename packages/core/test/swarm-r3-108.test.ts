import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";

describe("R3-108 multiline bypass", () => {
  it("flags ESM import split across lines", () => {
    const r = architectureCheckContents(
      [{ path: "src/a.ts", content: `import x from\n  "forbidden-module";` }],
      ["src/a.ts"],
      [{ type: "forbidden-import", module: "forbidden-module", reason: "banned" } as never],
    );
    expect(r.status).toBe("fail");
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("flags require() split across lines", () => {
    const r = architectureCheckContents(
      [{ path: "src/a.ts", content: `const x = require(\n  "forbidden-module")` }],
      ["src/a.ts"],
      [{ type: "forbidden-import", module: "forbidden-module", reason: "banned" } as never],
    );
    expect(r.status).toBe("fail");
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("flags forbidden pattern split by newline via \\s", () => {
    const r = architectureCheckContents(
      [{ path: "src/a.ts", content: "forbidden\npattern" }],
      ["src/a.ts"],
      [{ type: "forbidden-content", pattern: "forbidden\\s+pattern", reason: "banned" } as never],
    );
    expect(r.status).toBe("fail");
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

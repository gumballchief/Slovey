import { describe, expect, it } from "vitest";
import { architectureCheckContents } from "../src/preflight/architecture";
import type { ArchitectureRule } from "../src/preflight/types";

const rules: ArchitectureRule[] = [
  { type: "forbidden-import", module: "forbidden-module", reason: "do not use it" } as ArchitectureRule,
];

function statusFor(content: string) {
  return architectureCheckContents([{ path: "src/a.ts", content }], ["src/a.ts"], rules).status;
}

describe("forbidden-import bypasses", () => {
  it("blocks side-effect imports", () => {
    expect(statusFor(`import 'forbidden-module';`)).toBe("fail");
    expect(statusFor(`import "forbidden-module/sub";`)).toBe("fail");
  });
  it("blocks re-exports", () => {
    expect(statusFor(`export * from 'forbidden-module';`)).toBe("fail");
    expect(statusFor(`export { x } from 'forbidden-module';`)).toBe("fail");
    expect(statusFor(`export * from'forbidden-module';`)).toBe("fail");
  });
  it("blocks imports split across lines", () => {
    expect(statusFor(`import(\n  'forbidden-module'\n);`)).toBe("fail");
    expect(statusFor(`import\n'forbidden-module';`)).toBe("fail");
    expect(statusFor(`const x = require(\n'forbidden-module');`)).toBe("fail");
    expect(statusFor(`import foo\nfrom\n'forbidden-module';`)).toBe("fail");
  });
  it("still blocks normal imports and allows other modules", () => {
    expect(statusFor(`import foo from 'forbidden-module';`)).toBe("fail");
    expect(statusFor(`import 'allowed-module';`)).toBe("pass");
    expect(statusFor(`import 'forbidden-module-evil';`)).toBe("pass");
  });
});

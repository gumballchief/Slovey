import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function loadProtectedPath(): RegExp {
  const src = readFileSync(new URL("../src/pipelines/agent.ts", import.meta.url), "utf8");
  const match = src.match(/const PROTECTED_PATH = \/(.+)\/i;/);
  if (!match) throw new Error("PROTECTED_PATH not found");
  return new RegExp(match[1]!, "i");
}

describe("agent protected paths", () => {
  const re = loadProtectedPath();

  it.each([
    ".env",
    ".env.production",
    ".env.local",
    "src/.env.production",
    "package.json",
    "src/package.json",
    ".github/workflows/ci.yml",
    ".github/workflows-backup/ci.yml",
    "package-lock.json",
    "pnpm-lock.yaml",
  ])("blocks %s", (path) => {
    expect(re.test(path)).toBe(true);
  });

  it.each(["src/index.ts", "src/env.ts", "src/components/Button.tsx"])("allows %s", (path) => {
    expect(re.test(path)).toBe(false);
  });
});

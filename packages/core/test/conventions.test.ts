import { describe, expect, it } from "vitest";
import {
  deriveConventions,
  type PackageManifest,
  type RepoArchitecture,
} from "../src/pipelines/index-repo";

const manifests: PackageManifest[] = [
  {
    path: "package.json",
    name: "root",
    dependencies: { next: "15", "drizzle-orm": "0.36" },
    devDependencies: { vitest: "2" },
  },
  {
    path: "packages/db/package.json",
    name: "@x/db",
    dependencies: { "drizzle-orm": "0.36" },
    devDependencies: {},
  },
];

const paths = [
  "pnpm-workspace.yaml",
  "vitest.config.ts",
  "packages/db/src/schema.ts",
  "packages/db/src/foo.test.ts",
  "apps/web/app/api/health/route.ts",
  // kebab-case source files — should trigger the naming detector
  "apps/web/src/user-card.ts",
  "apps/web/src/data-client.ts",
  "apps/web/src/api-client.ts",
  "apps/web/src/use-repo.ts",
  "apps/web/src/rate-limit.ts",
  "apps/web/src/index-repo.ts",
];

const arch: RepoArchitecture = {
  languages: { TypeScript: 11 },
  frameworks: ["Next.js", "Drizzle", "Vitest"],
  services: [
    { name: "web", path: "apps/web", kind: "app" },
    { name: "db", path: "packages/db", kind: "package" },
  ],
  apiRoutes: ["apps/web/app/api/health/route.ts"],
  testStrategy: { hasTests: true, runners: ["Vitest"], testFileCount: 12 },
  fileCount: paths.length,
  topLevelDirs: ["apps", "packages"],
  summary: "monorepo",
};

describe("deriveConventions", () => {
  const decisions = deriveConventions(arch, manifests, paths);
  const byCategory = (c: string) => decisions.find((d) => d.category === c);

  it("derives database, framework, testing, architecture, and naming conventions", () => {
    expect(byCategory("database")).toBeTruthy();
    expect(byCategory("framework")).toBeTruthy();
    expect(byCategory("testing")).toBeTruthy();
    expect(byCategory("architecture")).toBeTruthy();
    expect(byCategory("naming")).toBeTruthy();
  });

  it("cites concrete file evidence on every convention (never invents)", () => {
    for (const d of decisions) expect(d.evidence.length).toBeGreaterThan(0);
  });

  it("points the DB convention at the manifest and schema file", () => {
    const db = byCategory("database")!;
    expect(db.decision).toContain("Drizzle ORM");
    expect(db.evidence).toContain("package.json");
    expect(db.evidence).toContain("packages/db/src/schema.ts");
  });

  it("detects the dominant kebab-case naming style", () => {
    expect(byCategory("naming")!.decision).toContain("kebab-case");
  });

  it("emits nothing for a bare repo (no manifests, no tests)", () => {
    const empty = deriveConventions(
      {
        ...arch,
        frameworks: [],
        services: [],
        testStrategy: { hasTests: false, runners: [], testFileCount: 0 },
        topLevelDirs: [],
      },
      [],
      ["readme.md", "config.yml"],
    );
    expect(empty).toEqual([]);
  });
});

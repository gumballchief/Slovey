import { getDb, repoKnowledge } from "@company-brain/db";
import { and, eq } from "drizzle-orm";
import { getAI } from "../ai";
import type { ExtractedDecision } from "../ai/types";
import { getInstallationOctokit } from "../github/app";
import { logger } from "../logger";
import { upsertDecisions } from "./upsert-decisions";

/**
 * Repository knowledge engine (Prompt 2's "Knowledge Processing"): parse a repo's
 * structure from the git tree + manifests and derive structured knowledge —
 * frameworks, services/modules, dependency graph, API routes, testing strategy,
 * and an LLM architecture summary. Stored in `repo_knowledge` (one row per kind).
 */

export interface PackageManifest {
  path: string;
  name?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface RepoArchitecture {
  languages: Record<string, number>; // extension → file count
  frameworks: string[];
  services: Array<{ name: string; path: string; kind: string }>;
  apiRoutes: string[];
  testStrategy: { hasTests: boolean; runners: string[]; testFileCount: number };
  fileCount: number;
  topLevelDirs: string[];
  summary: string;
}

export interface DependencyGraph {
  nodes: Array<{ id: string; type: "internal" | "external" }>;
  edges: Array<{ from: string; to: string }>;
}

const EXT_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  rb: "Ruby",
  php: "PHP",
  css: "CSS",
  scss: "CSS",
  md: "Markdown",
  json: "JSON",
  yml: "YAML",
  yaml: "YAML",
  sql: "SQL",
};

const FRAMEWORK_DEPS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  "@angular/core": "Angular",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  "drizzle-orm": "Drizzle",
  "@prisma/client": "Prisma",
  prisma: "Prisma",
  sequelize: "Sequelize",
  "pg-boss": "pg-boss",
  bullmq: "BullMQ",
  tailwindcss: "Tailwind CSS",
  vitest: "Vitest",
  jest: "Jest",
  "@playwright/test": "Playwright",
};

function ext(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m?.[1]?.toLowerCase() ?? "";
}

function isApiRoute(path: string): boolean {
  const p = path.toLowerCase();
  return (
    /(^|\/)app\/.*\/route\.(t|j)sx?$/.test(p) || // Next App Router
    /(^|\/)pages\/api\//.test(p) || // Next Pages API
    /(^|\/)routes?\//.test(p) || // generic routes dir
    /(^|\/)controllers?\//.test(p) // MVC controllers
  );
}

function detectServices(paths: string[]): RepoArchitecture["services"] {
  const services = new Map<string, { name: string; path: string; kind: string }>();
  for (const p of paths) {
    const m = p.match(/^(apps|packages|services|modules)\/([^/]+)\//);
    if (m && m[1] && m[2]) {
      const group = m[1];
      const svc = m[2];
      const key = `${group}/${svc}`;
      if (!services.has(key))
        services.set(key, { name: svc, path: key, kind: group.replace(/s$/, "") });
    }
  }
  return [...services.values()].slice(0, 50);
}

// ─────────────── convention detectors (citable decisions) ───────────────
// These turn structural facts into decisions with file-path evidence so a PR
// that adds raw SQL, a second ORM, a non-standard test runner, or duplicated
// shared code is caught by the SAME judge + citation guardrail as PR decisions.
// We never emit a convention without concrete file evidence (no inventing).

const ORM_DEPS: Record<string, string> = {
  "drizzle-orm": "Drizzle ORM",
  "@prisma/client": "Prisma",
  prisma: "Prisma",
  sequelize: "Sequelize",
  typeorm: "TypeORM",
  mongoose: "Mongoose",
  knex: "Knex",
};

const FRAMEWORK_PRIORITY = [
  "Next.js",
  "NestJS",
  "Express",
  "Fastify",
  "Django",
  "FastAPI",
  "Flask",
];

/** First manifest that declares each dependency — used for evidence citations. */
function depToManifest(manifests: PackageManifest[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of manifests) {
    for (const d of [...Object.keys(m.dependencies), ...Object.keys(m.devDependencies)]) {
      if (!map.has(d)) map.set(d, m.path);
    }
  }
  return map;
}

/** Dominant multi-word file-naming style, only when there's a clear majority. */
function namingConvention(paths: string[]): { style: string; examples: string[] } | null {
  const src = paths.filter(
    (p) => /\.(ts|tsx|js|jsx)$/.test(p) && !/\.(test|spec)\./.test(p) && !p.includes("node_modules"),
  );
  const buckets: Record<string, string[]> = { "kebab-case": [], camelCase: [], PascalCase: [], snake_case: [] };
  for (const p of src) {
    const base = (p.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(base)) buckets["kebab-case"]!.push(p);
    else if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(base)) buckets["snake_case"]!.push(p);
    else if (/^[A-Z][A-Za-z0-9]+$/.test(base) && /[a-z]/.test(base)) buckets["PascalCase"]!.push(p);
    else if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(base)) buckets["camelCase"]!.push(p);
  }
  const ranked = Object.entries(buckets).sort((a, b) => b[1].length - a[1].length);
  const top = ranked[0];
  const total = ranked.reduce((n, [, v]) => n + v.length, 0);
  // Need a meaningful sample and a clear (>=65%) majority to call it a convention.
  if (!top || top[1].length < 5 || top[1].length / total < 0.65) return null;
  return { style: top[0], examples: top[1].slice(0, 3) };
}

/** Build citable convention decisions from the derived structure + manifests. */
export function deriveConventions(
  arch: RepoArchitecture,
  manifests: PackageManifest[],
  paths: string[],
): ExtractedDecision[] {
  const out: ExtractedDecision[] = [];
  const depMap = depToManifest(manifests);

  // 1. ORM / database-access convention.
  const ormDep = Object.keys(ORM_DEPS).find((d) => depMap.has(d));
  if (ormDep) {
    const orm = ORM_DEPS[ormDep]!;
    const schemaFiles = paths
      .filter((p) => /(^|\/)(schema|models?)\.(ts|js|prisma)$/i.test(p) || /\.prisma$/.test(p))
      .slice(0, 3);
    const evidence = [depMap.get(ormDep)!, ...schemaFiles];
    out.push({
      decision: `Database access goes through ${orm}. New code should use ${orm}, not raw SQL strings or a second ORM/query builder.`,
      why: `${orm} is the established data layer (declared in ${depMap.get(ormDep)}). Mixing query layers fragments the schema and migrations.`,
      examples: schemaFiles,
      evidence,
      category: "database",
    });
  }

  // 2. Application framework convention.
  const framework = FRAMEWORK_PRIORITY.find((f) => arch.frameworks.includes(f));
  if (framework) {
    const dep = [...depMap.keys()].find((d) => FRAMEWORK_DEPS[d] === framework);
    const evidence = dep ? [depMap.get(dep)!] : manifests[0] ? [manifests[0].path] : [];
    if (evidence.length > 0) {
      out.push({
        decision: `The application framework is ${framework}. New endpoints/pages should follow ${framework} conventions rather than introducing a parallel framework.`,
        why: `${framework} is the chosen framework for this codebase.`,
        examples: arch.apiRoutes.slice(0, 3),
        evidence,
        category: "framework",
      });
    }
  }

  // 3. Test-runner convention.
  if (arch.testStrategy.runners.length > 0) {
    const runner = arch.testStrategy.runners[0]!;
    const configFile = paths.find((p) => /(vitest|jest|playwright)\.config\.[tj]s$/.test(p));
    const sampleTest = paths.find((p) => /\.(test|spec)\.[tj]sx?$/.test(p));
    const evidence = [configFile, sampleTest].filter((p): p is string => Boolean(p));
    if (evidence.length > 0) {
      out.push({
        decision: `Automated tests use ${runner}. New tests should be written for ${runner}, not a different test runner.`,
        why: `${runner} is the established test runner (${arch.testStrategy.testFileCount} test files).`,
        examples: sampleTest ? [sampleTest] : [],
        evidence,
        category: "testing",
      });
    }
  }

  // 4. Monorepo / shared-code convention.
  const hasApps = arch.topLevelDirs.includes("apps");
  const hasPackages = arch.topLevelDirs.includes("packages");
  if (hasApps && hasPackages && arch.services.length > 1) {
    const wsFile = paths.find((p) => /(pnpm-workspace\.yaml|turbo\.json|lerna\.json)$/.test(p));
    const evidence = [wsFile, ...arch.services.slice(0, 2).map((s) => s.path)].filter(
      (p): p is string => Boolean(p),
    );
    if (evidence.length > 0) {
      out.push({
        decision:
          "This is a monorepo: shared logic belongs in packages/* and is imported by apps/*, not copy-pasted across apps.",
        why: "Duplicating shared code across apps causes drift; packages/* is the single source of truth.",
        examples: arch.services.slice(0, 3).map((s) => s.path),
        evidence,
        category: "architecture",
      });
    }
  }

  // 5. File-naming convention (only when clearly dominant).
  const naming = namingConvention(paths);
  if (naming) {
    out.push({
      decision: `Source files follow ${naming.style} naming. New files should match this convention.`,
      why: `${naming.style} is the dominant naming style across the source tree.`,
      examples: naming.examples,
      evidence: naming.examples,
      category: "naming",
    });
  }

  // Guardrail: never store a convention without concrete file evidence.
  return out.filter((d) => d.evidence.length > 0);
}

export async function runIndexRepo(params: {
  repoId: string;
  installationId: number;
  owner: string;
  name: string;
  defaultBranch: string;
}): Promise<{
  architecture: RepoArchitecture;
  dependencyGraph: DependencyGraph;
  conventions: { inserted: number; updated: number };
}> {
  const octokit = await getInstallationOctokit(params.installationId);

  // 1. Full git tree.
  const tree = await octokit.rest.git.getTree({
    owner: params.owner,
    repo: params.name,
    tree_sha: params.defaultBranch,
    recursive: "1",
  });
  const blobs = tree.data.tree.filter((n) => n.type === "blob" && n.path);
  const paths = blobs.map((b) => b.path!);

  // 2. Languages by extension.
  const languages: Record<string, number> = {};
  for (const p of paths) {
    const lang = EXT_LANG[ext(p)];
    if (lang) languages[lang] = (languages[lang] ?? 0) + 1;
  }

  // 3. Read package.json manifests (root + workspaces) for deps + names.
  const manifestPaths = paths
    .filter((p) => p.endsWith("package.json") && !p.includes("node_modules"))
    .slice(0, 25);
  const manifests: PackageManifest[] = [];
  for (const mp of manifestPaths) {
    const node = blobs.find((b) => b.path === mp);
    if (!node?.sha) continue;
    try {
      const blob = await octokit.rest.git.getBlob({
        owner: params.owner,
        repo: params.name,
        file_sha: node.sha,
      });
      const json = JSON.parse(Buffer.from(blob.data.content, "base64").toString("utf8"));
      manifests.push({
        path: mp,
        name: json.name,
        dependencies: json.dependencies ?? {},
        devDependencies: json.devDependencies ?? {},
      });
    } catch {
      /* skip unparseable */
    }
  }

  // 4. Frameworks from merged deps.
  const allDeps = new Set<string>();
  for (const m of manifests) {
    for (const d of Object.keys(m.dependencies)) allDeps.add(d);
    for (const d of Object.keys(m.devDependencies)) allDeps.add(d);
  }
  const frameworks = [...new Set(
    [...allDeps].map((d) => FRAMEWORK_DEPS[d]).filter((f): f is string => Boolean(f)),
  )];

  // 5. Services, API routes, tests, structure.
  const services = detectServices(paths);
  const apiRoutes = paths.filter(isApiRoute).slice(0, 100);
  const testFileCount = paths.filter((p) => /\.(test|spec)\.[tj]sx?$/.test(p) || /(^|\/)__tests__\//.test(p)).length;
  const runners = ["vitest", "jest", "@playwright/test", "mocha"]
    .filter((r) => allDeps.has(r))
    .map((r) => FRAMEWORK_DEPS[r] ?? r);
  const topLevelDirs = [
    ...new Set(
      paths
        .map((p) => p.split("/")[0])
        .filter((d): d is string => typeof d === "string" && d.length > 0 && !d.includes(".")),
    ),
  ].slice(0, 30);

  // 6. Internal dependency graph (workspace packages depending on each other) +
  //    the most common external deps.
  const internalNames = new Set(manifests.map((m) => m.name).filter(Boolean) as string[]);
  const nodes: DependencyGraph["nodes"] = [];
  const edges: DependencyGraph["edges"] = [];
  for (const n of internalNames) nodes.push({ id: n, type: "internal" });
  const externalCount: Record<string, number> = {};
  for (const m of manifests) {
    const deps = { ...m.dependencies, ...m.devDependencies };
    for (const dep of Object.keys(deps)) {
      if (internalNames.has(dep)) {
        if (m.name) edges.push({ from: m.name, to: dep });
      } else {
        externalCount[dep] = (externalCount[dep] ?? 0) + 1;
      }
    }
  }
  const topExternal = Object.entries(externalCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([d]) => d);
  for (const d of topExternal) nodes.push({ id: d, type: "external" });

  // 7. LLM architecture summary from the derived facts (one cheap call).
  const factSheet = JSON.stringify(
    { frameworks, languages, services, apiRoutesSample: apiRoutes.slice(0, 20), topLevelDirs, topExternal, fileCount: paths.length },
    null,
    2,
  );
  const summary =
    (await getAI().completeJSON<{ summary: string }>(
      `You are a staff engineer describing a codebase to a new hire. Based ONLY on these derived facts, write a concise 2-3 sentence architecture summary (stack, structure, notable choices). Do not invent specifics not implied by the facts.\n\nFACTS:\n${factSheet}\n\nRespond ONLY with JSON: {"summary":"..."}`,
      { tier: "cheap", maxTokens: 400 },
    ))?.summary ?? "";

  const architecture: RepoArchitecture = {
    languages,
    frameworks,
    services,
    apiRoutes,
    testStrategy: { hasTests: testFileCount > 0 || runners.length > 0, runners, testFileCount },
    fileCount: paths.length,
    topLevelDirs,
    summary,
  };
  const dependencyGraph: DependencyGraph = { nodes, edges };

  // 8. Upsert knowledge rows (replace prior of each kind).
  const db = getDb();
  await db
    .delete(repoKnowledge)
    .where(and(eq(repoKnowledge.repoId, params.repoId), eq(repoKnowledge.kind, "architecture")));
  await db
    .delete(repoKnowledge)
    .where(and(eq(repoKnowledge.repoId, params.repoId), eq(repoKnowledge.kind, "dependency_graph")));
  await db.insert(repoKnowledge).values([
    { repoId: params.repoId, kind: "architecture", data: architecture },
    { repoId: params.repoId, kind: "dependency_graph", data: dependencyGraph },
  ]);

  // 9. Derive citable convention decisions and fold them into the repo's memory
  //    (same embed + dedup path as extract) so the judge can warn on structural
  //    conflicts — DB/ORM usage, framework, test runner, shared-code, naming.
  let conventions = { inserted: 0, updated: 0 };
  try {
    const derived = deriveConventions(architecture, manifests, paths);
    if (derived.length > 0) {
      conventions = await upsertDecisions(
        params.repoId,
        derived.map((d) => ({ d, source: "repo_analysis" as const })),
        "repo_analysis",
      );
    }
    logger.child({ component: "index-repo" }).info("conventions derived", {
      repo: `${params.owner}/${params.name}`,
      derived: derived.length,
      ...conventions,
    });
  } catch (e) {
    logger.child({ component: "index-repo" }).warn("convention derivation failed", { err: e });
  }

  return { architecture, dependencyGraph, conventions };
}

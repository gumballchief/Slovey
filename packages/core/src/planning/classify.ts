import type { ScopeQuery } from "../graph/types";
import type { PlanIntent } from "./types";

// Ordered: first match wins, so more-specific intents (migration, security)
// are tested before the catch-all "feature". Pure + deterministic + testable;
// the LLM never classifies intent.
const INTENT_RULES: Array<[PlanIntent, RegExp]> = [
  ["migration", /\b(migrat\w*|move (?:to|off)|port(?:ing)? to|switch(?:ing)? to|replace \w+ with|rewrite in)\b/i],
  ["security", /\b(security|secure|auth(?:entication|orization|n|z)?|oauth|jwt|sso|saml|encrypt\w*|secret|credential|vulnerab\w*|csrf|xss|injection|rbac|permission)\b/i],
  ["performance", /\b(perf(?:ormance)?|latency|throughput|optimi\w*|cache|caching|slow|speed ?up|bottleneck|scal\w*)\b/i],
  ["database", /\b(database|schema|table|column|sql|postgres\w*|mysql|mongo\w*|index(?:es|ing)?|query|orm|migration table)\b/i],
  ["api", /\b(api|endpoint|route|graphql|rest|webhook|grpc|openapi|sdk)\b/i],
  ["infrastructure", /\b(infra(?:structure)?|deploy\w*|kubernetes|k8s|docker|container|terraform|ci\/?cd|pipeline|cloud|aws|gcp|azure)\b/i],
  ["testing", /\b(test\w*|spec|coverage|e2e|unit ?test|integration ?test|mock)\b/i],
  ["documentation", /\b(document\w*|docs|readme|adr|rfc|changelog)\b/i],
  ["refactor", /\b(refactor\w*|clean ?up|restructure|reorganis\w*|reorganiz\w*|rename|extract|dedup\w*|simplif\w*)\b/i],
  ["bugfix", /\b(bug|fix(?:es|ing)?|broken|crash\w*|regression|hotfix|defect|incorrect)\b/i],
  ["research", /\b(research|investigat\w*|explor\w*|spike|evaluat\w*|should we|thinking about|consider\w*|prototype)\b/i],
  ["feature", /\b(add|build|implement|creat\w*|introduc\w*|support|enable|new feature|ship)\b/i],
];

export interface IntentMatch {
  intent: PlanIntent;
  matched: string | null;
}

/** Classify the engineering intent of a request. Deterministic. */
export function classifyIntent(request: string): IntentMatch {
  for (const [intent, re] of INTENT_RULES) {
    const m = request.match(re);
    if (m) return { intent, matched: m[0].toLowerCase() };
  }
  return { intent: "unknown", matched: null };
}

// Known vocabularies for entity extraction. Kept small and explicit — a real
// path→service map replaces this at scale, but matching named technologies is
// the high-signal, low-noise extraction that actually helps retrieval.
const LANGUAGES = [
  "typescript", "javascript", "python", "golang", "rust", "java", "ruby",
  "kotlin", "swift", "php", "scala", "elixir", "c#", "c++",
];
const FRAMEWORKS = [
  "react", "next.js", "nextjs", "vue", "svelte", "angular", "express",
  "fastapi", "django", "flask", "rails", "spring", "tailwind", "redux",
  "prisma", "drizzle", "graphql", "trpc", "remix", "nestjs",
];
const TECH = [
  "redis", "postgres", "postgresql", "mysql", "mongodb", "kafka", "rabbitmq",
  "sqs", "grpc", "docker", "kubernetes", "k8s", "terraform", "elasticsearch",
  "s3", "dynamodb", "snowflake", "clickhouse", "nginx", "stripe",
];
const DOMAINS = [
  "billing", "payments", "payment", "auth", "authentication", "authorization",
  "checkout", "search", "notifications", "notification", "onboarding",
  "analytics", "messaging", "inventory", "catalog", "reporting", "ingestion",
];

function findAll(haystack: string, vocab: string[]): string[] {
  const lc = haystack.toLowerCase();
  const out: string[] = [];
  for (const term of vocab) {
    // word-ish boundary: term surrounded by non-alphanumerics (handles ".", "#", "+").
    const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.+#]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (re.test(lc)) out.push(term);
  }
  return [...new Set(out)];
}

/**
 * Extract a scope (languages / frameworks / services / domains) from free text.
 * Deterministic vocabulary match plus PascalCase `*Service` tokens. Used to ask
 * the graph "which decisions govern this area?" — never to invent facts.
 */
export function extractScope(request: string): ScopeQuery {
  const languages = findAll(request, LANGUAGES);
  const frameworks = [...findAll(request, FRAMEWORKS), ...findAll(request, TECH)];
  const domains = findAll(request, DOMAINS);

  // PascalCase service-like identifiers, e.g. "PaymentService", "AuthGateway".
  const services = [
    ...new Set((request.match(/\b[A-Z][a-zA-Z0-9]*(?:Service|Gateway|Worker|Api|Handler)\b/g) ?? [])),
  ];

  const scope: ScopeQuery = {};
  if (languages.length) scope.languages = languages;
  if (frameworks.length) scope.frameworks = frameworks;
  if (domains.length) scope.domains = domains;
  if (services.length) scope.services = services;
  return scope;
}

/** Intents whose blast radius makes them inherently higher-risk. */
const HIGH_RISK_INTENTS: PlanIntent[] = ["security", "migration"];
const MEDIUM_RISK_INTENTS: PlanIntent[] = ["infrastructure", "database", "performance", "api"];

/**
 * Deterministic risk level. A disallowed verdict or rejected precedent is always
 * high; otherwise risk follows the intent's blast radius and how settled the
 * recorded decisions are.
 */
export function assessRisk(args: {
  intent: PlanIntent;
  verdict: "allowed" | "disallowed" | "unclear";
  hasRejectedPrecedent: boolean;
  constraintCount: number;
}): RiskLevelInternal {
  if (args.verdict === "disallowed" || args.hasRejectedPrecedent) return "high";
  if (HIGH_RISK_INTENTS.includes(args.intent)) return "high";
  if (MEDIUM_RISK_INTENTS.includes(args.intent)) return "medium";
  if (args.verdict === "unclear" && args.constraintCount > 0) return "medium";
  return "low";
}

type RiskLevelInternal = "low" | "medium" | "high";

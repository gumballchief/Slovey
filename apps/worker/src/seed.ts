import { loadEnv } from "@company-brain/config";
import { getEmbeddings } from "@company-brain/core";
import {
  closeDb,
  decisions,
  getDb,
  installations,
  repoSettings,
  repos,
} from "@company-brain/db";

/**
 * The prototype's proven brain.json (gumballchief/pr-bot-test). Seeded so the
 * retrieve/judge/eval stages have real memory to run against without a live
 * GitHub extract. Evidence strings are split into citation arrays.
 */
const PROTO_DECISIONS: Array<{
  decision: string;
  examples: string[];
  evidence: string;
  category: string;
}> = [
  {
    decision:
      "Bug fixes must address the root cause with a targeted, minimal change rather than a workaround or defensive band-aid on the client side",
    examples: [
      "Toast-on-error workaround for booking modal unmount rejected in favor of server-side root cause fix",
      "Embed SDK initialization in OnboardingLayout rejected as incorrect init location",
    ],
    evidence: "PR #29295, PR #29297",
    category: "architecture",
  },
  {
    decision:
      "HTTP methods must match the API contract exactly; wrong verbs that cause side effects (e.g. duplicates) are not acceptable",
    examples: [
      "Office365 updateMeeting using POST instead of PATCH caused duplicate meetings",
      "deleteMeeting being a no-op with no HTTP request",
    ],
    evidence: "PR #29499",
    category: "api-contract",
  },
  {
    decision:
      "Runtime environment variables that differ between server and client must not be inlined at build time; dynamic resolution is required",
    examples: [
      "WEBAPP_URL hardcoded at build time broke self-hosted Docker deployments",
      "window.location.origin approach rejected in favor of proper env handling",
    ],
    evidence: "PR #28182",
    category: "env-config",
  },
  {
    decision:
      "Security-sensitive changes (CORS, CSP, auth headers) must go through internal security review rather than community PRs",
    examples: [
      "CORS wildcard restriction PR rejected",
      "Missing CSP/HSTS/X-XSS-Protection headers PR rejected",
    ],
    evidence: "PR #29442",
    category: "security",
  },
  {
    decision:
      "Debounced or stateful callbacks in React must be stabilized with useRef to prevent recreation on every render",
    examples: [
      "ForgotPassword debounce recreated on every render fixed by moving into useRef",
      "Debounce timer not persisting across renders",
    ],
    evidence: "PR #28490",
    category: "react-state",
  },
  {
    decision:
      "New third-party payment integrations require a formal review process and are not accepted as community PRs without prior approval",
    examples: ["Paystack payment integration PR rejected", "BigBlueButton integration PR rejected"],
    evidence: "PR #29296, PR #10803",
    category: "payments",
  },
  {
    decision:
      "Console.log statements that leak private or sensitive data must be removed from production code",
    examples: [
      "console.log dumping private hashed link data in tRPC update.handler.ts",
      "console.log(e) replaced with proper logger calls",
    ],
    evidence: "PR #29529",
    category: "logging",
  },
  {
    decision:
      "Unsolicited UI/cosmetic-only changes without a linked issue or stated rationale are rejected",
    examples: [
      "'changed background colors' PR rejected with no description",
      "'changed color' PR rejected with no description",
    ],
    evidence: "PR #29625, PR #29627",
    category: "ui-cosmetic",
  },
  {
    decision:
      "Platform-specific deployment config files are rejected (render.yaml, fly.toml, railway.json, Procfile, vercel.json)",
    examples: ["render.yaml (Render)", "fly.toml (Fly.io)", "Procfile (Heroku)", "vercel.json"],
    evidence: "PR #29636",
    category: "deploy-config",
  },
  {
    decision:
      "Utility functions must use standard library APIs correctly; misuse of arguments must be fixed at the source with a clean helper",
    examples: [
      "padStart(4 - len, '0') was wrong; fixed to padStart(4, '0') inside a suffix() helper",
      "Multi-digit suffixes were not zero-padded due to incorrect first argument",
    ],
    evidence: "PR #29571, PR #29601",
    category: "other",
  },
  {
    decision:
      "Shared UI components (e.g. DialogHeader) must be reused rather than re-implementing equivalent markup inline",
    examples: [
      "Confirmation dialog header/footer misaligned because icon and title were rendered ad-hoc instead of using DialogHeader",
      "Refactored to use shared DialogHeader implementation",
    ],
    evidence: "PR #29588",
    category: "architecture",
  },
  {
    decision:
      "Dead or broken links must be removed from documentation rather than left as placeholders",
    examples: [
      "GitHub Discussions links returning 404 removed from README",
      "Links leftover from cal.com copied README removed",
    ],
    evidence: "PR #29617",
    category: "docs",
  },
  {
    decision:
      "TODO and @ts-expect-error suppression comments must be removed once the underlying issue is resolved",
    examples: [
      "Obsolete @ts-expect-error around setValue for interval limit removed after type was fixed",
      "TODO comment removed after referenced work was completed",
    ],
    evidence: "PR #29638",
    category: "other",
  },
  {
    decision:
      "Agent/AI rule files should use path-scoped frontmatter so rules are only loaded for relevant files",
    examples: [
      "architecture-page-level-auth.md scoped to apps/**/page.tsx and layout.tsx",
      "data-prisma-migration rule scoped to migration-related paths",
    ],
    evidence: "PR #29612",
    category: "architecture",
  },
];

async function main() {
  loadEnv();
  const db = getDb();

  const [inst] = await db
    .insert(installations)
    .values({ githubInstallationId: 0, accountLogin: "gumballchief", accountType: "User" })
    .onConflictDoUpdate({
      target: installations.githubInstallationId,
      set: { accountLogin: "gumballchief" },
    })
    .returning();
  if (!inst) throw new Error("seed: failed to create installation");

  const [repo] = await db
    .insert(repos)
    .values({
      installationId: inst.id,
      githubRepoId: 0,
      owner: "gumballchief",
      name: "pr-bot-test",
      fullName: "gumballchief/pr-bot-test",
      defaultBranch: "main",
      isPrivate: false,
    })
    .onConflictDoUpdate({ target: repos.fullName, set: { installationId: inst.id } })
    .returning();
  if (!repo) throw new Error("seed: failed to create repo");

  await db.insert(repoSettings).values({ repoId: repo.id }).onConflictDoNothing();

  const emb = getEmbeddings();
  let n = 0;
  for (const d of PROTO_DECISIONS) {
    const evidence = d.evidence.split(",").map((s) => s.trim());
    const text = [d.decision, d.examples.join(" ")].join("\n");
    const vec = await emb.embedOne(text);
    await db.insert(decisions).values({
      repoId: repo.id,
      decision: d.decision,
      why: "",
      examples: d.examples,
      evidence,
      source: "github_pr",
      category: d.category,
      status: "approved",
      embedding: vec,
      createdBy: "seed",
    });
    n++;
  }

  console.log(`Seeded ${n} decisions for gumballchief/pr-bot-test (repoId=${repo.id})`);
  await closeDb();
}

main().catch(async (err) => {
  console.error("seed failed:", err);
  await closeDb();
  process.exit(1);
});

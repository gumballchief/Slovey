import { loadEnv, type ConfidenceThreshold } from "@company-brain/config";
import {
  getAI,
  guardWarning,
  judgePrompt,
  resolveRepo,
  retrieveDecisions,
  type CitableDecision,
  type JudgeResult,
} from "@company-brain/core";
import { closeDb } from "@company-brain/db";

interface Fixture {
  title: string;
  body: string;
  changedFiles?: string[];
  shouldWarn: boolean; // ground truth
}

/** Real-ish fixtures derived from the prototype's decisions. */
const FIXTURES: Fixture[] = [
  { title: "Add render.yaml for Render.com deployment", body: "Adds a render.yaml so we can deploy to Render.", changedFiles: ["render.yaml"], shouldWarn: true },
  { title: "Add Paystack payment integration", body: "Integrates Paystack as a new payment provider.", changedFiles: ["src/payments/paystack.ts"], shouldWarn: true },
  { title: "Restrict CORS to specific origins", body: "Tightens the CORS wildcard and adds CSP headers.", changedFiles: ["src/middleware/cors.ts"], shouldWarn: true },
  { title: "Use POST instead of PATCH for meeting updates", body: "Switches updateMeeting to POST.", changedFiles: ["src/handlers/meetings.ts"], shouldWarn: true },
  { title: "Inline WEBAPP_URL at build time", body: "Hardcodes WEBAPP_URL during build for speed.", changedFiles: ["next.config.js"], shouldWarn: true },
  { title: "Fix null pointer in user profile service", body: "Guards against an undefined user before access; root cause fix.", changedFiles: ["src/services/profile.ts"], shouldWarn: false },
  { title: "Add unit tests for suffix() helper", body: "Adds coverage for the zero-padding helper.", changedFiles: ["src/utils/suffix.test.ts"], shouldWarn: false },
  { title: "Refactor auth token refresh flow", body: "Cleaner refresh logic, no behavior change.", changedFiles: ["src/auth/refresh.ts"], shouldWarn: false },
  { title: "Fix typo in README setup section", body: "Corrects a command typo.", changedFiles: ["README.md"], shouldWarn: false },
];

const THRESHOLDS: ConfidenceThreshold[] = ["low", "high", "strict"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Judge a fixture ONCE (threshold-independent). Returns the verdict + candidates. */
async function judgeFixture(
  repoId: string,
  f: Fixture,
): Promise<{ result: JudgeResult | null; citable: CitableDecision[] }> {
  const pr = { title: f.title, body: f.body, changedFiles: f.changedFiles };
  const retrieved = await retrieveDecisions(repoId, pr); // no categorize → fewer API calls
  const citable: CitableDecision[] = retrieved.map((d) => ({
    id: d.id,
    decision: d.decision,
    evidence: d.evidence,
  }));
  if (retrieved.length === 0) return { result: null, citable };
  const result = await getAI().completeJSON<JudgeResult>(
    judgePrompt(
      retrieved.map((d) => ({ decision: d.decision, examples: d.examples, evidence: d.evidence })),
      pr,
    ),
    { tier: "premium", maxTokens: 400 },
  );
  return { result, citable };
}

async function main() {
  loadEnv();
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) {
    console.error("Repo not found. Run `pnpm seed` first.");
    await closeDb();
    process.exit(1);
  }

  console.log(`Judging ${FIXTURES.length} fixtures once each (repo ${repo.fullName})…\n`);

  // Judge each fixture once, throttled to respect per-minute rate limits.
  const judged: Array<{ f: Fixture; result: JudgeResult | null; citable: CitableDecision[] }> = [];
  for (const f of FIXTURES) {
    const { result, citable } = await judgeFixture(repo.repoId, f);
    judged.push({ f, result, citable });
    console.log(
      `  ${f.shouldWarn ? "[warn]" : "[fine]"} ${f.title.slice(0, 48).padEnd(48)} → warn=${result?.warn ?? "?"} conf=${result?.confidence ?? "-"}`,
    );
    await sleep(3000);
  }

  console.log("\nMetrics per threshold:\n");
  for (const threshold of THRESHOLDS) {
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    for (const { f, result, citable } of judged) {
      const warned = result ? guardWarning(result, citable, threshold).post : false;
      if (f.shouldWarn && warned) tp++;
      else if (!f.shouldWarn && warned) fp++;
      else if (!f.shouldWarn && !warned) tn++;
      else fn++;
    }
    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
    const fpRate = fp + tn === 0 ? 0 : fp / (fp + tn);
    console.log(
      `threshold=${threshold.padEnd(6)}  precision=${precision.toFixed(2)}  recall=${recall.toFixed(2)}  fp-rate=${fpRate.toFixed(2)}  (TP=${tp} FP=${fp} TN=${tn} FN=${fn})`,
    );
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error("eval failed:", err);
  await closeDb();
  process.exit(1);
});

import { architectureCheckContents, rulesFromRejectedDecisions } from "./architecture";
import { loadPreflightConfig } from "./config";
import { fetchRejectedDecisions, runDecisionCheck } from "./decisions";
import { scanForSecrets } from "./redact";
import type { DecisionViolation } from "./types";

export interface GeneratedGateVerdict {
  blocked: boolean;
  /** Agent-readable problem lines — fed back into the revise prompt verbatim. */
  problems: string[];
  decisionViolations: DecisionViolation[];
}

/**
 * The agent's pre-PR gate: run the knowledge checks (secret scan, architecture
 * rules incl. derived-from-rejected, decision graph) on a GENERATED file before
 * it ever reaches GitHub. Command checks (typecheck/test) can't run here — the
 * content exists only in memory, not in a workspace — so this gate complements
 * the post-PR checkPr review rather than replacing it.
 */
export async function checkGeneratedFile(
  repoId: string,
  path: string,
  content: string,
): Promise<GeneratedGateVerdict> {
  const files = [{ path, content }];
  const problems: string[] = [];

  // 1. Secrets in generated code (models occasionally hallucinate real-looking keys).
  const { config } = loadPreflightConfig(process.cwd());
  if (config.secretScan.enabled) {
    for (const e of scanForSecrets(files)) {
      problems.push(`secret-scan: ${e.message} (${path}${e.line ? `:${e.line}` : ""})`);
    }
  }

  // 2. Architecture rules — config + derived from rejected decisions.
  const rules = [
    ...config.architectureChecks.rules,
    ...(config.architectureChecks.deriveFromDecisions ? rulesFromRejectedDecisions(await fetchRejectedDecisions(repoId)) : []),
  ];
  if (config.architectureChecks.enabled && rules.length > 0) {
    const arch = architectureCheckContents(files, [path], rules);
    for (const e of arch.errors) {
      problems.push(`architecture: ${e.message} (${path}${e.line ? `:${e.line}` : ""})`);
    }
  }

  // 3. Decision graph on a pseudo-diff of the new file.
  let decisionViolations: DecisionViolation[] = [];
  if (config.decisionChecks.enabled) {
    const diff = `+++ b/${path} (new file)\n${content.split("\n").map((l) => `+${l}`).join("\n")}`.slice(0, 12_000);
    const { violations } = await runDecisionCheck(repoId, diff, [path]);
    decisionViolations = violations;
    for (const v of violations) {
      if (!config.decisionChecks.blockOnHighConfidence || v.confidence >= config.decisionChecks.minimumBlockingConfidence) {
        problems.push(`decision: ${v.instructionForAgent}`);
      }
    }
  }

  return { blocked: problems.length > 0, problems, decisionViolations };
}

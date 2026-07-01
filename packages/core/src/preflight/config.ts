import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG, type PreflightConfig } from "./types";

export const CONFIG_FILENAME = "companybrain.preflight.json";

/**
 * Load companybrain.preflight.json from `cwd`, merged over the defaults. A missing
 * or malformed file is non-fatal — we fall back to defaults so preflight always runs.
 * Nested sections (decisionChecks/architectureChecks/secretScan/commands) merge
 * per-key so a config that sets one field doesn't wipe the rest.
 */
export function loadPreflightConfig(
  cwd: string,
  override: Partial<PreflightConfig> = {},
): { config: PreflightConfig; source: "file" | "default"; warning?: string } {
  let fileCfg: Partial<PreflightConfig> = {};
  let source: "file" | "default" = "default";
  let warning: string | undefined;
  try {
    const raw = readFileSync(resolve(cwd, CONFIG_FILENAME), "utf8");
    fileCfg = JSON.parse(raw) as Partial<PreflightConfig>;
    source = "file";
  } catch (e) {
    if ((e as { code?: string })?.code !== "ENOENT") {
      warning = `Could not parse ${CONFIG_FILENAME}; using defaults (${e instanceof Error ? e.message : String(e)})`;
    }
  }
  const config: PreflightConfig = {
    ...DEFAULT_CONFIG,
    ...fileCfg,
    ...override,
    commands: { ...(fileCfg.commands ?? {}), ...(override.commands ?? {}) },
    allowlistedCommands: override.allowlistedCommands ?? fileCfg.allowlistedCommands ?? [],
    requiredChecks: override.requiredChecks ?? fileCfg.requiredChecks ?? DEFAULT_CONFIG.requiredChecks,
    decisionChecks: { ...DEFAULT_CONFIG.decisionChecks, ...(fileCfg.decisionChecks ?? {}), ...(override.decisionChecks ?? {}) },
    architectureChecks: {
      ...DEFAULT_CONFIG.architectureChecks,
      ...(fileCfg.architectureChecks ?? {}),
      ...(override.architectureChecks ?? {}),
    },
    secretScan: { ...DEFAULT_CONFIG.secretScan, ...(fileCfg.secretScan ?? {}), ...(override.secretScan ?? {}) },
  };
  return { config, source, warning };
}

/** The starter config `companybrain preflight init` writes. */
export function defaultConfigJson(): string {
  const starter: PreflightConfig = {
    ...DEFAULT_CONFIG,
    architectureChecks: {
      enabled: true,
      rules: [
        // Examples — edit or remove. Rules run against changed files only.
        // { type: "forbidden-import", module: "lodash", reason: "Use native ES utilities instead." },
        // { type: "forbidden-content", pattern: "process\\.exit\\(", in: "src/**", reason: "Throw instead of exiting." },
      ],
    },
  };
  return `${JSON.stringify(starter, null, 2)}\n`;
}

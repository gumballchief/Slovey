import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG, type PreflightConfig } from "./types";

export const CONFIG_FILENAME = "companybrain.preflight.json";

/**
 * Load companybrain.preflight.json from `cwd`, merged over the defaults. A missing
 * or malformed file is non-fatal — we fall back to defaults so preflight always runs.
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
    requiredChecks: override.requiredChecks ?? fileCfg.requiredChecks ?? DEFAULT_CONFIG.requiredChecks,
  };
  return { config, source, warning };
}

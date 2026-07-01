import { execFile, spawn } from "node:child_process";
import { redact } from "./redact";

const IS_WIN = process.platform === "win32";

/**
 * Kill the whole process tree, not just the immediate child. Tools like `pnpm`
 * spawn nested shells/binaries (`next build`, etc.) — killing only the wrapper
 * leaves orphans that hold locks (e.g. Next's build lock) and jam later runs.
 * Windows: taskkill /T kills the tree. POSIX: the child is spawned detached in
 * its own process group, so kill(-pid) reaches every descendant.
 */
function killTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (IS_WIN) {
    execFile("taskkill", ["/pid", String(child.pid), "/t", "/f"], () => {});
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL"); // group kill failed (e.g. not the group leader) — best effort
  }
}

/** Only these base binaries may be executed. Everything else is refused. */
export const ALLOWED_BINS = new Set([
  "npm", "pnpm", "yarn", "bun", "npx", "node", "tsx",
  "tsc", "eslint", "biome", "prettier", "vitest", "jest", "next",
]);

/** Reject anything with shell metacharacters — prevents command injection. */
const SAFE_COMMAND = /^[\w@./:= +-]+$/;

const MAX_OUTPUT = 200_000; // cap captured stdout/stderr per stream

export interface CommandOutcome {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  refusedReason?: string;
}

/**
 * Run an allowlisted command with no shell interpolation, a hard timeout, output
 * caps, and secret redaction. `command` is a plain string like "pnpm typecheck".
 */
export function runCommand(cwd: string, command: string, timeoutMs: number): Promise<CommandOutcome> {
  const started = Date.now();
  const refuse = (refusedReason: string): CommandOutcome => ({
    ok: false, code: null, stdout: "", stderr: "", timedOut: false,
    durationMs: Date.now() - started, refusedReason,
  });

  const trimmed = command.trim();
  if (!SAFE_COMMAND.test(trimmed)) {
    return Promise.resolve(refuse(`refused: command contains unsafe characters: ${command}`));
  }
  const tokens = trimmed.split(/\s+/);
  const bin = tokens[0]!;
  if (!ALLOWED_BINS.has(bin)) {
    return Promise.resolve(refuse(`refused: "${bin}" is not an allowlisted command`));
  }

  return new Promise<CommandOutcome>((resolvePromise) => {
    // shell:true only on Windows (pnpm/npm are .cmd); args are already validated
    // against SAFE_COMMAND so no metacharacters can reach the shell.
    const child = spawn(bin, tokens.slice(1), {
      cwd,
      shell: IS_WIN,
      windowsHide: true,
      env: process.env,
      // POSIX: own process group so killTree() can kill(-pid) the whole tree.
      // (Windows has no equivalent; taskkill /T handles it there instead.)
      detached: !IS_WIN,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const cap = (buf: string, chunk: string) => (buf.length >= MAX_OUTPUT ? buf : (buf + chunk).slice(0, MAX_OUTPUT));

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout = cap(stdout, d.toString())));
    child.stderr?.on("data", (d) => (stderr = cap(stderr, d.toString())));

    child.on("error", (err) => {
      clearTimeout(timer);
      resolvePromise({
        ok: false, code: null, stdout: redact(stdout),
        stderr: redact(`${stderr}\n${err.message}`), timedOut,
        durationMs: Date.now() - started,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        ok: !timedOut && code === 0,
        code,
        stdout: redact(stdout),
        stderr: redact(stderr),
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
}

import type { PreflightError } from "./types";

/**
 * Secret-like patterns for both redaction (output) and scanning (source).
 *
 * `heuristic` patterns match by shape, not by a provider-specific prefix, so they
 * fire on legitimate examples (a `postgres://user:pass@host` in a README, a
 * placeholder `token = "your-token-here"`, a fake JWT in a test). Those are
 * placeholder-filtered and skipped in test/prose files during scanning (but still
 * redacted from captured output — better safe there). Non-heuristic patterns are
 * real provider key formats and always fire; `valueGroup` is the capture group
 * holding the sensitive value (for placeholder checks).
 */
const SECRET_PATTERNS: { label: string; re: RegExp; heuristic?: boolean; valueGroup?: number }[] = [
  { label: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { label: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { label: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "OpenAI/Anthropic key", re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g },
  // Stripe/related secret + restricted keys use an UNDERSCORE (sk_live_…), which
  // the sk- pattern above misses. Publishable keys (pk_…) are public — not listed.
  { label: "Stripe secret key", re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, heuristic: true },
  { label: "connection string with password", re: /\b[a-z][a-z0-9+.-]*:\/\/([^\s:@/]+):([^\s:@/]+)@[^\s/]+/gi, heuristic: true, valueGroup: 2 },
  { label: "hardcoded secret assignment", re: /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"]([A-Za-z0-9_\-./+=]{12,})['"]/gi, heuristic: true, valueGroup: 1 },
];

/** Obvious placeholder / example / weak-default values — not real leaked secrets. */
const PLACEHOLDER_TOKENS = [
  "example", "placeholder", "your-", "your_", "yourkey", "changeme", "change-me",
  "change_me", "replace", "redact", "dummy", "sample", "<", ">", "xxxx", "0000",
  "todo", "insert", "notreal", "fake", "-here", "foobar",
];
const WEAK_VALUES = new Set([
  "password", "passwd", "pass", "secret", "admin", "root", "user", "username",
  "test", "postgres", "mysql", "example", "changeme", "local", "guest",
]);

/** True when a matched secret value is clearly illustrative rather than a real leak. */
function looksLikePlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  if (WEAK_VALUES.has(v)) return true;
  if (PLACEHOLDER_TOKENS.some((t) => v.includes(t))) return true;
  if (/^(.)\1{7,}$/.test(value)) return true; // same char repeated 8+ times
  return false;
}

/** Files whose secret-shaped snippets are almost always fixtures/examples, not leaks. */
const TEST_FILE = /(^|[\\/])(__tests__|__mocks__|tests?|e2e|fixtures?)[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/i;
const PROSE_FILE = /\.(md|mdx|markdown|rst|txt|adoc)$/i;
/** Template files exist to hold placeholder secrets — skip them entirely. */
const TEMPLATE_FILE = /\.(example|sample|template|dist)\.[^.\\/]+$/i;
const ENV_TEMPLATE_FILES = new Set([".env.example", ".env.sample", ".env.template"]);

/** Replace any secret-looking substrings with a marker. Used on all captured output. */
export function redact(text: string): string {
  let out = text;
  for (const { re } of SECRET_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

/** Scan changed source files for hardcoded secrets. Returns one error per hit. */
export function scanForSecrets(files: { path: string; content: string }[]): PreflightError[] {
  const errors: PreflightError[] = [];
  for (const { path, content } of files) {
    const base = path.split(/[\\/]/).pop() ?? path;
    // Templates deliberately document placeholder secrets — never a leak.
    if (ENV_TEMPLATE_FILES.has(base) || TEMPLATE_FILE.test(base)) continue;
    const softFile = TEST_FILE.test(path) || PROSE_FILE.test(path);
    const lines = content.split("\n");
    for (const { label, re, heuristic, valueGroup } of SECRET_PATTERNS) {
      // Shape-based patterns are noisy in fixtures/docs; the real provider-key
      // formats still fire everywhere.
      if (heuristic && softFile) continue;
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lines[i]!)) !== null) {
          const value = valueGroup ? (m[valueGroup] ?? m[0]) : m[0];
          if (heuristic && looksLikePlaceholder(value)) {
            if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
            continue;
          }
          errors.push({ file: path, line: i + 1, code: "secret", message: `Possible ${label} committed in source.` });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      }
    }
  }
  return errors;
}

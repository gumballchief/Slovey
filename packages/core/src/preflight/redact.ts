import type { PreflightError } from "./types";

/** Secret-like patterns for both redaction (output) and scanning (source). */
const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { label: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { label: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "OpenAI/Anthropic key", re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { label: "connection string with password", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@[^\s/]+/gi },
  { label: "hardcoded secret assignment", re: /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][A-Za-z0-9_\-./+=]{12,}['"]/gi },
];

/** Replace any secret-looking substrings with a marker. Used on all captured output. */
export function redact(text: string): string {
  let out = text;
  for (const { re } of SECRET_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

/**
 * Env-var templates (.env.example / .sample / .template) exist to document the
 * *shape* of secrets — placeholder connection strings and key blocks are their
 * whole point, not a leak. Real secrets live in the gitignored .env, which never
 * reaches a diff. Skip templates so editing one doesn't trip the scanner.
 */
const ENV_TEMPLATE_FILES = new Set([".env.example", ".env.sample", ".env.template"]);

/** Scan changed source files for hardcoded secrets. Returns one error per hit. */
export function scanForSecrets(files: { path: string; content: string }[]): PreflightError[] {
  const errors: PreflightError[] = [];
  for (const { path, content } of files) {
    const base = path.split(/[\\/]/).pop() ?? path;
    if (ENV_TEMPLATE_FILES.has(base)) continue;
    const lines = content.split("\n");
    for (const { label, re } of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (re.test(lines[i]!)) {
          errors.push({ file: path, line: i + 1, code: "secret", message: `Possible ${label} committed in source.` });
        }
      }
    }
  }
  return errors;
}

/**
 * Tiny zero-dependency structured logger (JSON lines). Levels via LOG_LEVEL,
 * context via child loggers, and automatic redaction of secret-looking fields.
 * Kept dependency-free to avoid native build steps; swap for pino later if needed.
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /(api[_-]?key|secret|token|password|authorization|private[_-]?key)/i;

function envLevel(): Level {
  const l = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return (["debug", "info", "warn", "error"] as const).includes(l as Level)
    ? (l as Level)
    : "info";
}

function redact(fields: Record<string, unknown>, seen = new WeakSet<object>()): Record<string, unknown> {
  seen.add(fields);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) out[k] = "[redacted]";
    else out[k] = redactValue(v, seen);
  }
  return out;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Error) return { message: value.message, name: value.name };
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    return redact(value as Record<string, unknown>, seen);
  }
  return value;
}

export class Logger {
  private min: number;
  constructor(private ctx: Record<string, unknown> = {}) {
    this.min = ORDER[envLevel()];
  }

  child(ctx: Record<string, unknown>): Logger {
    return new Logger({ ...this.ctx, ...ctx });
  }

  private emit(level: Level, msg: string, fields?: Record<string, unknown>) {
    if (ORDER[level] < this.min) return;
    const line = JSON.stringify({
      t: new Date().toISOString(),
      level,
      msg,
      ...redact(this.ctx),
      ...(fields ? redact(fields) : {}),
    });
    // Route to the matching console method so stdout/stderr split is preserved.
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(msg: string, fields?: Record<string, unknown>) {
    this.emit("debug", msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>) {
    this.emit("info", msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>) {
    this.emit("warn", msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>) {
    this.emit("error", msg, fields);
  }
}

/** Process-wide root logger. Prefer `logger.child({ component })` in modules. */
export const logger = new Logger();

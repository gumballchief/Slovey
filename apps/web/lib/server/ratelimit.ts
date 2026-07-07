import { HttpError } from "./respond";

/**
 * Fixed-window in-memory rate limiter. Sufficient for a single instance; for
 * multi-instance deployments swap the store for Postgres/Redis (the interface
 * stays the same). The signature check is the real webhook protection — this is
 * flood control.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    throw new HttpError(429, `Rate limit exceeded. Retry in ${retry}s.`);
  }
}

/**
 * Best-effort client IP from proxy headers. Uses the RIGHTMOST x-forwarded-for
 * entry: that's the one appended by our own edge proxy (Render), while leftmost
 * values are client-supplied and trivially spoofable to dodge rate limiting.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Periodic cleanup of expired buckets; don't keep the process alive for it.
const timer = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of store) if (now > b.resetAt) store.delete(k);
}, 60_000);
(timer as { unref?: () => void }).unref?.();

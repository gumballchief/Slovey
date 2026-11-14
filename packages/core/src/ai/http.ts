import type { AICompleteOptions } from "./types";

/**
 * Total time budget for one provider call (all internal retries included). The
 * premium tier is a "thinking" model that legitimately takes ~40-50s, so it gets
 * a larger budget than the cheap tier. Without a bound, a hung socket blocks the
 * whole gate indefinitely and reads as "broken" to the user; the deterministic
 * fallbacks are there precisely so we can give up and still return a verdict.
 * Callers may override with opts.timeoutMs.
 */
export function budgetMs(opts: AICompleteOptions): number {
  if (opts.timeoutMs && opts.timeoutMs > 0) return opts.timeoutMs;
  return opts.tier === "cheap" ? 25_000 : 75_000;
}

/**
 * fetch() with a hard AbortController timeout. Throws `<label> timed out after
 * Nms` on timeout so callers' existing catch/fallback paths handle it uniformly.
 * `timeoutMs` is clamped to a floor so a nearly-exhausted deadline still makes a
 * real attempt rather than aborting instantly.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label = "AI request",
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs));
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    if (ctrl.signal.aborted) throw new Error(`${label} timed out after ${timeoutMs}ms`);
    throw err;
  }
  // Keep the deadline alive until the body is fully consumed: resolving on
  // headers alone would let a stalled/trickling body hang callers' subsequent
  // res.text()/json() reads forever. Wrap the body in a new Response (the
  // original's methods are read-only) whose stream races each read against
  // the same abort signal, and clear the timer once the body ends/cancels.
  if (!res.body || res.status === 204 || res.status === 205 || res.status === 304) {
    clearTimeout(timer);
    return res;
  }
  const reader = res.body.getReader();
  const abortPromise = new Promise<never>((_, reject) => {
    ctrl.signal.addEventListener(
      "abort",
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      { once: true },
    );
  });
  abortPromise.catch(() => undefined);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await Promise.race([reader.read(), abortPromise]);
        if (done) {
          clearTimeout(timer);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        clearTimeout(timer);
        try {
          await reader.cancel();
        } catch {
          /* already closed */
        }
        if (ctrl.signal.aborted) {
          controller.error(new Error(`${label} timed out after ${timeoutMs}ms`));
        } else {
          controller.error(err);
        }
      }
    },
    async cancel(reason) {
      clearTimeout(timer);
      try {
        await reader.cancel(reason);
      } catch {
        /* already closed */
      }
    },
  });
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/** Parse JSON tolerating ```fences and surrounding prose; undefined if nothing parses. */
export function tryParseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    const match = text.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* unparseable */
      }
    }
  }
  return undefined;
}

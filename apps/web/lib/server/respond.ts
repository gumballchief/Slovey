/** Thin helpers for typed JSON responses + uniform error handling in route handlers. */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json(data as object, init);
}

export function fail(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unhandled error:", err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}

/** Wrap a handler body so thrown HttpErrors become proper responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return fail(err);
  }
}

/**
 * Read + parse a JSON body with a hard size cap. Next's App Router has no default
 * body-size limit, so `req.json()` would otherwise buffer an arbitrarily large
 * body into memory. Checks Content-Length first (cheap reject), then the actual
 * bytes (header can lie or be absent). Returns {} for an empty body.
 */
export async function readJsonBody<T>(req: Request, maxBytes = 1_000_000): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${Math.round(maxBytes / 1000)}KB).`);
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${Math.round(maxBytes / 1000)}KB).`);
  }
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

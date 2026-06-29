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

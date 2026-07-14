import { reasoning } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { fail, HttpError } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming Engineering Search (SSE). Same answer as GET /ask, but the prose is
 * streamed token-by-token as the model emits it, then a final `done` event
 * carries the resolved citations + confidence. The UI types the answer out
 * instead of sitting on a spinner. Auth/rate-limit run before the stream opens,
 * so failures still return a normal JSON error.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  let id: string;
  try {
    const viewer = await requireViewer();
    ({ id } = await ctx.params);
    await assertRepoAccess(id, viewer);
    rateLimit(`ask:${viewer.userId ?? viewer.login}`, 30, 60_000);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (!q) throw new HttpError(400, "q is required");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const write = (s: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(s));
          } catch {
            closed = true; // client disconnected
          }
        };
        const send = (obj: unknown) => write(`data: ${JSON.stringify(obj)}\n\n`);

        // Defeat proxy buffering (Render's edge / nginx-style layers): an initial
        // ~2KB comment forces intermediaries to start forwarding the response
        // immediately instead of buffering it whole, and a keepalive ping every
        // 1.5s keeps bytes flowing during the pre-first-token retrieval + model
        // "thinking" gap. Comment lines (":") are ignored by the SSE client, so
        // this is invisible to the answer stream.
        write(`:${" ".repeat(2048)}\n\n`);
        const ping = setInterval(() => write(": ping\n\n"), 1500);

        try {
          for await (const ev of reasoning.engineeringSearchStream(id, q)) send(ev);
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
        } finally {
          clearInterval(ping);
          closed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        // Disable proxy buffering (Render/nginx) so tokens flush immediately.
        "x-accel-buffering": "no",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

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
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          for await (const ev of reasoning.engineeringSearchStream(id, q)) send(ev);
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
        } finally {
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

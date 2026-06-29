import { JOBS, enqueue, parseWebhook, verifySignature } from "@company-brain/core";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GitHub App webhook. Verifies the signature, parses intents, enqueues jobs via
 * pg-boss, and returns 202 immediately — all heavy work runs in the worker so we
 * always ack in well under 2s.
 */
export async function POST(req: Request): Promise<Response> {
  // Flood protection (signature verification below is the real auth).
  try {
    rateLimit(`webhook:${clientIp(req)}`, 600, 60_000);
  } catch {
    return new Response("rate limited", { status: 429 });
  }

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";
  const raw = await req.text();

  if (!(await verifySignature(raw, signature))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const intents = parseWebhook(event, payload);
  for (const intent of intents) {
    switch (intent.type) {
      case "sync_installation":
        await enqueue(JOBS.syncInstallation, { installationId: intent.installationId });
        break;
      case "extract":
        await enqueue(JOBS.extract, {
          installationId: intent.installationId,
          fullName: intent.fullName,
        });
        break;
      case "check_pr":
        await enqueue(JOBS.checkPr, {
          installationId: intent.installationId,
          fullName: intent.fullName,
          prNumber: intent.prNumber,
          action: intent.action,
        });
        break;
      case "feedback":
        await enqueue(JOBS.feedback, {
          installationId: intent.installationId,
          fullName: intent.fullName,
          prNumber: intent.prNumber,
          action: intent.action,
          byUser: intent.byUser,
          reason: intent.reason,
        });
        break;
    }
  }

  return new Response("accepted", { status: 202 });
}

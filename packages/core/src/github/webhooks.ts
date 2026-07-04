import { loadEnv } from "@company-brain/config";
import { Webhooks } from "@octokit/webhooks";

let _wh: Webhooks | null = null;
function webhooks(): Webhooks {
  if (_wh) return _wh;
  const env = loadEnv();
  _wh = new Webhooks({ secret: env.GITHUB_WEBHOOK_SECRET ?? "" });
  return _wh;
}

/** Verify the X-Hub-Signature-256 over the raw request body. */
export async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  try {
    return await webhooks().verify(rawBody, signature);
  } catch {
    return false;
  }
}

/** Normalized intents the webhook produces; the worker acts on them. */
export type WebhookIntent =
  | { type: "sync_installation"; installationId: number }
  | { type: "extract"; installationId: number; fullName: string }
  | {
      type: "check_pr";
      installationId: number;
      fullName: string;
      prNumber: number;
      action: "opened" | "synchronize";
    }
  | {
      type: "feedback";
      installationId: number;
      fullName: string;
      prNumber: number;
      action: "dismiss" | "confirm";
      byUser: string;
      reason?: string;
    };

// Anchored to the start of the comment (optional leading backtick) so the bot's
// own instructional text ("reply `/brain dismiss`") never matches as a command.
const DISMISS_RE = /^\s*`?\/brain\s+dismiss\b/i;
const CONFIRM_RE = /^\s*`?\/brain\s+confirm\b/i;

function isBotComment(comment: any): boolean {
  const user = comment?.user;
  return (
    user?.type === "Bot" ||
    Boolean(comment?.performed_via_github_app) ||
    (typeof user?.login === "string" && user.login.endsWith("[bot]"))
  );
}

/**
 * Parse a verified webhook into job intents. Pure + synchronous so the route
 * handler can enqueue and return 202 in well under 2s.
 */
export function parseWebhook(event: string, payload: any): WebhookIntent[] {
  const installationId: number | undefined = payload?.installation?.id;
  if (!installationId) return [];

  switch (event) {
    case "installation": {
      const intents: WebhookIntent[] = [{ type: "sync_installation", installationId }];
      if (payload.action === "created") {
        for (const r of payload.repositories ?? []) {
          intents.push({ type: "extract", installationId, fullName: r.full_name });
        }
      }
      return intents;
    }
    case "installation_repositories": {
      const intents: WebhookIntent[] = [{ type: "sync_installation", installationId }];
      for (const r of payload.repositories_added ?? []) {
        intents.push({ type: "extract", installationId, fullName: r.full_name });
      }
      return intents;
    }
    case "pull_request": {
      if (payload.action !== "opened" && payload.action !== "synchronize") return [];
      // Defensive: never crash on a malformed payload (missing repo / non-numeric PR).
      const fullName = payload.repository?.full_name;
      const prNumber = payload.pull_request?.number;
      if (typeof fullName !== "string" || typeof prNumber !== "number") return [];
      return [{ type: "check_pr", installationId, fullName, prNumber, action: payload.action }];
    }
    case "issue_comment": {
      if (payload.action !== "created" || !payload.issue?.pull_request) return [];
      // Never act on our own (or any bot's) comments — prevents self-dismissal loops.
      if (isBotComment(payload.comment)) return [];
      const body: string = payload.comment?.body ?? "";
      const action = DISMISS_RE.test(body)
        ? "dismiss"
        : CONFIRM_RE.test(body)
          ? "confirm"
          : null;
      if (!action) return [];
      const fullName = payload.repository?.full_name;
      const prNumber = payload.issue?.number;
      if (typeof fullName !== "string" || typeof prNumber !== "number") return [];
      return [
        {
          type: "feedback",
          installationId,
          fullName,
          prNumber,
          action,
          byUser: payload.comment?.user?.login ?? "unknown",
          reason: body,
        },
      ];
    }
    default:
      return [];
  }
}

import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Security — Company Brain",
  description: "What Company Brain stores from your repositories, what it never stores, and how it's protected.",
};

export default function SecurityPage() {
  return (
    <LegalShell title="Security & What We Store" updated="July 6, 2026">
      <p>
        Company Brain reads engineering discussion to build your team&rsquo;s decision memory. The
        most common question we get is &ldquo;you&rsquo;re reading my code — what exactly do you
        keep?&rdquo; This page is the plain-English answer.
      </p>

      <h2>1. What we store</h2>
      <ul>
        <li>
          <strong>Decisions, not source.</strong> The memory is built from pull-request titles,
          descriptions, review comments, and documentation (READMEs, ADRs, docs folders). What we
          persist are the extracted <em>decisions</em> — short statements like &ldquo;we rejected
          Redis for session storage because…&rdquo; — with links back to the PRs they came from.
        </li>
        <li>
          <strong>Embeddings.</strong> Numeric vectors of those decisions (not of your source code)
          so search and PR matching work.
        </li>
        <li>
          <strong>Check results.</strong> For each PR we check: the PR number, title, author,
          verdict, and the comment we posted.
        </li>
        <li>
          <strong>Account data.</strong> Your GitHub login, email, and avatar from sign-in; org
          membership and roles you configure.
        </li>
      </ul>

      <h2>2. What we never store</h2>
      <ul>
        <li>
          <strong>Your codebase.</strong> Diffs are read transiently during a check or extraction
          and are not persisted. There is no copy of your repository in our database.
        </li>
        <li>
          <strong>Secrets.</strong> The Preflight CLI redacts anything key-shaped from command
          output before it leaves your machine, and the hosted secret-scan blocks key-shaped
          strings in submitted changes rather than storing them.
        </li>
      </ul>

      <h2>3. How it&rsquo;s protected</h2>
      <ul>
        <li>
          <strong>Connector tokens</strong> (Linear, Notion, Slack) are encrypted at rest with
          AES-256-GCM and are never returned by any API after you save them.
        </li>
        <li>
          <strong>CLI tokens</strong> are stored only as SHA-256 hashes, compared in constant time,
          revocable at any moment from the dashboard, and scoped to a single repository.
        </li>
        <li>
          <strong>Webhooks</strong> from GitHub and Stripe are signature-verified before a single
          byte is processed.
        </li>
        <li>
          <strong>Tenancy</strong> is enforced on every API route: your data is only reachable by
          members of your organization, with role-based read/write separation.
        </li>
        <li>
          <strong>Transport & storage.</strong> TLS everywhere; the database (Supabase Postgres) is
          encrypted at rest by the provider.
        </li>
      </ul>

      <h2>4. Deleting your data</h2>
      <p>
        Uninstalling the GitHub App stops all ingestion. Deleting a repository connection deletes
        its decisions, embeddings, and check history (cascading deletes at the database level).
        For full account deletion, contact us and we remove the organization and every associated
        row.
      </p>

      <h2>5. Questions</h2>
      <p>
        Security question or something you&rsquo;d like to report? Email us — we read everything
        and respond fast.
      </p>
    </LegalShell>
  );
}

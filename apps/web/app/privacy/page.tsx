import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Slovey",
  description: "How Slovey collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 1, 2026">
      <p>
        This Privacy Policy explains how Slovey (&ldquo;Slovey,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and protects information when you use
        our engineering-memory service (the &ldquo;Service&rdquo;). By using the Service you agree
        to this Policy.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with GitHub, Google, or email, we
          receive your name, email address, avatar, and provider user ID.
        </li>
        <li>
          <strong>GitHub repository data.</strong> With your authorization (via the Slovey
          GitHub App), we access repositories you connect: pull requests, commits, diffs, review
          comments, documentation, and code structure — used to build your team&rsquo;s decision
          memory.
        </li>
        <li>
          <strong>Content you create.</strong> Decisions, feedback, settings, and other input you
          provide in the dashboard.
        </li>
        <li>
          <strong>Usage &amp; device data.</strong> Log data, IP address, browser type, and pages
          viewed, for security and to operate the Service.
        </li>
        <li>
          <strong>Cookies.</strong> We use strictly-necessary cookies for authentication and
          preferences (e.g. theme). We do not use advertising cookies.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide the Service: extract, store, and surface engineering decisions and warnings.</li>
        <li>To analyze pull requests against your recorded decisions and post results.</li>
        <li>To authenticate you and secure your account.</li>
        <li>To communicate about the Service, and to comply with legal obligations.</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        To extract decisions and evaluate pull requests, we send relevant repository content (such
        as diffs, PR text, and documentation) to third-party AI providers acting as our processors.
        This content is used to generate results for you and is not used by us to train public
        models. See our subprocessors below.
      </p>

      <h2>4. Subprocessors &amp; third parties</h2>
      <p>We share data with service providers strictly to operate the Service:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and storage.</li>
        <li><strong>GitHub</strong> — source of repository data and an authentication provider.</li>
        <li><strong>Google</strong> — an authentication provider (Sign in with Google).</li>
        <li><strong>Google (Gemini) / Anthropic</strong> — AI processing of repository content.</li>
        <li><strong>Render</strong> — application hosting.</li>
        <li><strong>Stripe</strong> — payment processing (if/when you subscribe to a paid plan).</li>
      </ul>
      <p>
        We do not sell your personal information. We disclose data only as described here, or when
        required by law.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain your data for as long as your account is active or as needed to provide the
        Service. You may disconnect a repository or delete your account at any time; we then delete
        or de-identify associated data within a reasonable period, except where retention is
        required by law.
      </p>

      <h2>6. Security</h2>
      <p>
        We use encryption in transit, access controls, and encryption at rest for sensitive tokens.
        No method of transmission or storage is perfectly secure, but we work to protect your data
        using industry-standard measures.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location (e.g. EEA/UK under GDPR, California under CCPA/CPRA), you may have
        the right to access, correct, delete, or port your data, and to object to or restrict
        certain processing. To exercise these rights, contact us at{" "}
        <a href="mailto:privacy@your-domain.example">privacy@your-domain.example</a>.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Your data may be processed in countries other than your own. Where required, we rely on
        appropriate safeguards for such transfers.
      </p>

      <h2>9. Children</h2>
      <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>
        We may update this Policy. Material changes will be posted here with a new &ldquo;Last
        updated&rdquo; date.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Contact us at{" "}
        <a href="mailto:privacy@your-domain.example">privacy@your-domain.example</a>.
      </p>
    </LegalShell>
  );
}

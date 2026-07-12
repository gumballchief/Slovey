import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service — Slovey",
  description: "The terms that govern your use of Slovey.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 1, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Slovey
        (the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these
        Terms. If you use the Service on behalf of an organization, you represent that you have
        authority to bind that organization.
      </p>

      <h2>1. The Service</h2>
      <p>
        Slovey records your team&rsquo;s engineering decisions and analyzes pull requests
        against that memory, surfacing warnings and citations. Features may change over time.
      </p>

      <h2>2. Accounts &amp; eligibility</h2>
      <p>
        You must be at least 16 and provide accurate information. You are responsible for activity
        under your account and for keeping your credentials secure.
      </p>

      <h2>3. Your content &amp; authorizations</h2>
      <p>
        You retain all rights to your code, repositories, and other content
        (&ldquo;Your Content&rdquo;). You grant us a limited license to access and process Your
        Content solely to provide the Service. You are responsible for having the rights and
        permissions to connect any repository you authorize.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not use the Service unlawfully or to infringe others&rsquo; rights.</li>
        <li>Do not attempt to breach security, disrupt, reverse engineer, or overload the Service.</li>
        <li>Do not connect repositories you are not authorized to access.</li>
        <li>Do not resell or provide the Service to third parties except as permitted.</li>
      </ul>

      <h2>5. AI-generated output — no guarantee</h2>
      <p>
        The Service uses automated and AI systems to extract decisions and evaluate pull requests.
        <strong> Its warnings, suggestions, and analysis may be incomplete or incorrect.</strong>{" "}
        They are informational only and are not professional, legal, or security advice. You remain
        solely responsible for reviewing, testing, and deciding whether to act on any output,
        including any code changes you merge.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        We and our licensors own the Service, including its software, design, and trademarks. These
        Terms grant you no rights to our intellectual property except the limited right to use the
        Service.
      </p>

      <h2>7. Fees</h2>
      <p>
        Paid plans (if any) are billed through our payment processor. Fees are described at
        purchase, are non-refundable except as required by law, and may change with notice.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service integrates with third parties (e.g. GitHub, Supabase, Google, AI providers). Your
        use of those services is governed by their terms, and we are not responsible for them.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong>{" "}
        without warranties of any kind, express or implied, including merchantability, fitness for a
        particular purpose, and non-infringement. We do not warrant that the Service will be
        uninterrupted, error-free, or accurate.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, data, or goodwill. Our
        total liability for any claim relating to the Service will not exceed the greater of the
        amounts you paid us in the 12 months before the claim or USD&nbsp;100.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold us harmless from claims arising out of Your Content, your use
        of the Service, or your violation of these Terms or applicable law.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access if you
        violate these Terms or to protect the Service. Provisions that by their nature should survive
        termination will survive.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of <strong>[your jurisdiction]</strong>, without regard
        to conflict-of-laws rules. Disputes will be resolved in the courts located there, unless
        applicable law provides otherwise.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms. Material changes will be posted here with a new &ldquo;Last
        updated&rdquo; date; continued use after changes means you accept them.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:legal@your-domain.example">legal@your-domain.example</a>.
      </p>
    </LegalShell>
  );
}

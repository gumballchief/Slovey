import type { Metadata } from "next";
import { PageShell, ComingSoon } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Changelog — Company Brain",
  description: "What's new in Company Brain — product updates, new checks, and integrations.",
};

export default function ChangelogPage() {
  return (
    <PageShell
      eyebrow="Product"
      title="Changelog"
      intro="Product updates, new checks, and integrations as they ship."
    >
      <ComingSoon>
        We're publishing our public changelog soon. In the meantime, follow along by{" "}
        <a href="/login" className="text-[var(--primary)] underline">signing in</a> or{" "}
        <a href="/contact" className="text-[var(--primary)] underline">getting in touch</a>.
      </ComingSoon>
    </PageShell>
  );
}

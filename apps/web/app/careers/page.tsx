import type { Metadata } from "next";
import { PageShell, ComingSoon } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Careers — Company Brain",
  description: "Help build the engineering-memory layer beneath AI coding agents. We're a small, early team hiring thoughtfully.",
};

export default function CareersPage() {
  return (
    <PageShell
      eyebrow="Company"
      title="Careers"
      intro="We're a small, early team building the memory layer beneath AI coding agents. We hire thoughtfully and value engineers who care about the reasoning behind the code, not just the code."
    >
      <ComingSoon>
        We don't have open roles posted right now. If you're excited about this problem, introduce yourself at{" "}
        <a href="/contact" className="text-[var(--primary)] underline">our contact page</a> — we read every note.
      </ComingSoon>
    </PageShell>
  );
}

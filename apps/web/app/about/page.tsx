import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "About — Company Brain",
  description: "Why engineering memory matters: Company Brain keeps the reasoning behind your code so knowledge is never lost, re-explained, or repeated as a mistake.",
};

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="Company"
      title="About Company Brain"
      intro="AI can write code faster than ever — but it doesn't know your company. We're building the memory layer that gives every agent your context, enforces your standards, and stops mistakes before they ship."
    >
      <div className="max-w-2xl space-y-4 text-[15px] leading-relaxed text-[color-mix(in_oklab,var(--cb-text)_88%,transparent)]">
        <p>
          Every engineering team accumulates hard-won decisions — why a retry path was removed, which pattern caused an outage, what convention the codebase actually follows. Most of that lives in people's heads, buried PRs, and stale docs. When someone leaves, it leaves with them.
        </p>
        <p>
          Company Brain captures that reasoning as a structured decision graph, tied to the pull requests and incidents that shaped it, and makes it queryable by humans and AI agents alike. The result is code written your way, reviewed against what your team already learned.
        </p>
        <p>
          We're an early, focused team. If that mission resonates, we'd love to <a href="/contact" className="text-[var(--primary)] underline">hear from you</a>.
        </p>
      </div>
    </PageShell>
  );
}

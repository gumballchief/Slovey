import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About",
  description:
    "Why engineering memory matters: Slovey keeps the reasoning behind your code so knowledge is never lost, re-explained, or repeated as a mistake.",
};

export default function AboutPage() {
  return (
    <SitePage
      eyebrow="Company"
      title={
        <>
          AI writes the code. <span className="dim">It doesn&apos;t know your company.</span>
        </>
      }
      lede="We're building the memory layer that gives every coding agent your team's context, holds it to your standards, and stops known mistakes before they ship."
      art="/art/laptop.webp"
    >
      <article className="st-prose">
        <p>
          Every engineering team builds up hard-won decisions: why a retry path was removed, which pattern caused an
          outage, what the codebase actually follows. Most of it lives in people&apos;s heads, old pull requests and docs
          nobody opens. When someone leaves, it leaves with them, and an agent never had it to begin with.
        </p>
        <p>
          Slovey reads your team&apos;s merged and rejected pull requests, turns the reasoning in them into a graph of
          decisions, and keeps each one tied to the pull request or incident that set it. People and agents can ask it
          questions, and every new change gets checked against it before it lands.
        </p>
        <p>
          The result is code written your way, reviewed against everything your team already learned, with the receipts
          to show why.
        </p>
        <h2>Open by default</h2>
        <p>
          Slovey is open source under the MIT license. You can read every line of how it decides, run it yourself, or
          use the hosted version at slovey.ai.
        </p>
        <p>
          We&apos;re a small, early team. If the problem resonates, <Link href="/contact">we&apos;d like to hear from you</Link>.
        </p>
      </article>
    </SitePage>
  );
}

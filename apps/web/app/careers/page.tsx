import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/careers" },
  title: "Careers",
  description: "Help build the engineering-memory layer beneath AI coding agents. We're a small, early team hiring thoughtfully.",
};

export default function CareersPage() {
  return (
    <SitePage
      eyebrow="Careers"
      title={
        <>
          Build the memory <span className="dim">under every agent.</span>
        </>
      }
      lede="We're a small, early team. We hire carefully and value engineers who care about the reasoning behind the code, not only the code."
      art="/art/obj-3.webp"
    >
      <article className="st-prose">
        <h2>No open roles right now</h2>
        <p>
          We don&apos;t have roles posted at the moment. If this problem excites you, tell us what you&apos;d build: write
          to us through the <Link href="/contact">contact page</Link>. We read every note.
        </p>
        <p>
          The fastest way to show us how you think is a pull request. The code is on{" "}
          <a href="https://github.com/gumballchief/slovey" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </article>
    </SitePage>
  );
}

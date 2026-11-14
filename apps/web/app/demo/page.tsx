import type { Metadata } from "next";
import { Demo } from "@/features/site/Demo";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/demo" },
  title: "Live demo",
  description: "Pick a pull request and watch Slovey check it against a team's decisions. No sign-in.",
};

export default function DemoPage() {
  return (
    <SitePage
      eyebrow="Live demo"
      title={
        <>
          Watch it catch <span className="dim">a bad change.</span>
        </>
      }
      lede="Pick a pull request. Slovey checks it against the team's decisions and explains any block with where the rule came from."
      art="/art/card-caught.webp"
      wide
    >
      <Demo />
    </SitePage>
  );
}

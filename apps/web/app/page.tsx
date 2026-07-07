import type { Metadata } from "next";
import { LandingEffects } from "@/components/landing/LandingEffects";
import landing from "@/components/landing/markup.json";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: "Company Brain — The intelligence layer beneath your AI coding agents",
  description:
    "AI writes great code — it just doesn't know your company. Company Brain gives it your context: your codebase, decisions, and history, so mistakes are caught before code is ever committed.",
};

export default function LandingPage() {
  return (
    <>
      {/* No-JS / failed-hydration fallback: never leave reveal content hidden. */}
      <noscript>
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: "#cb-landing [data-reveal]{opacity:1!important;transform:none!important;filter:none!important}" }} />
      </noscript>
      <div id="cb-landing" dangerouslySetInnerHTML={{ __html: (landing as { html: string }).html }} />
      <LandingEffects />
    </>
  );
}

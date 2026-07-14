"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AmbientBackground } from "./AmbientBackground";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { IntroLoader } from "./IntroLoader";
import { LandingEffects } from "./LandingEffects";
import { CtaSection } from "./CtaSection";
import { FAQSection } from "./FAQSection";
import { FooterSection } from "./FooterSection";
import { Marquee } from "./Marquee";
import { Nav } from "./Nav";
import { PinnedCodeMock } from "./PinnedCodeMock";
import { PricingSection } from "./PricingSection";
import { SocialProof } from "./SocialProof";
import { StatementSection } from "./StatementSection";
import restAfterStatement from "./rest-after-statement.json";
import restB2a from "./rest-b2a.json";

// The two pinned scrollytelling sections are the heaviest client components on
// the page — split them out of the main bundle (they still SSR, so content and
// SEO are unchanged; their JS just loads after hydration starts).
const PinnedWorkflow = dynamic(() => import("./PinnedWorkflow").then((m) => m.PinnedWorkflow));
const PinnedUseCases = dynamic(() => import("./PinnedUseCases").then((m) => m.PinnedUseCases));


/**
 * Landing shell. The hero + nav are real animated components (framer-motion); the
 * remaining sections are the design's markup (already reveal-animated via
 * LandingEffects) and are being converted to components incrementally.
 */
export function Landing() {
  const reduce = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      <AmbientBackground />
      <div id="cb-landing" style={{ position: "relative", zIndex: 1 }}>
        {/* Inside #cb-landing so its fixed overlay inherits the theme vars. */}
        <IntroLoader onDone={() => setIntroDone(true)} />
        <Nav />
        <Hero introDone={introDone || !!reduce} />
        <PinnedCodeMock />
        <SocialProof />
        <Marquee />
        <StatementSection />
        <div dangerouslySetInnerHTML={{ __html: (restAfterStatement as { html: string }).html }} />
        <Features />
        <PinnedWorkflow />
        <div dangerouslySetInnerHTML={{ __html: (restB2a as { html: string }).html }} />
        <PinnedUseCases />
        <PricingSection />
        <FAQSection />
        <CtaSection />
        <FooterSection />
      </div>
      <LandingEffects />
    </>
  );
}

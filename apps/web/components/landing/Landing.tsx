"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AmbientBackground } from "./AmbientBackground";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { IntroLoader } from "./IntroLoader";
import { LandingEffects } from "./LandingEffects";
import { Marquee } from "./Marquee";
import { Nav } from "./Nav";
import { PinnedUseCases } from "./PinnedUseCases";
import { PinnedWorkflow } from "./PinnedWorkflow";
import { SocialProof } from "./SocialProof";
import { StatementSection } from "./StatementSection";
import restAfterStatement from "./rest-after-statement.json";
import restB2a from "./rest-b2a.json";
import restB2b from "./rest-b2b.json";

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
      <IntroLoader onDone={() => setIntroDone(true)} />
      <AmbientBackground />
      <div id="cb-landing" style={{ position: "relative", zIndex: 1 }}>
        <Nav />
        <Hero introDone={introDone || !!reduce} />
        <SocialProof />
        <Marquee />
        <StatementSection />
        <div dangerouslySetInnerHTML={{ __html: (restAfterStatement as { html: string }).html }} />
        <Features />
        <PinnedWorkflow />
        <div dangerouslySetInnerHTML={{ __html: (restB2a as { html: string }).html }} />
        <PinnedUseCases />
        <div dangerouslySetInnerHTML={{ __html: (restB2b as { html: string }).html }} />
      </div>
      <LandingEffects />
    </>
  );
}

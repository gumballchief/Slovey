"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AmbientBackground } from "./AmbientBackground";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { IntroLoader } from "./IntroLoader";
import { LandingEffects } from "./LandingEffects";
import { Marquee } from "./Marquee";
import { Nav } from "./Nav";
import { SocialProof } from "./SocialProof";
import { StatementSection } from "./StatementSection";
import restAfterStatement from "./rest-after-statement.json";
import restB2a from "./rest-b2a.json";
import restB2b from "./rest-b2b.json";

// The two pinned scrollytelling sections are the heaviest client components on
// the page — split them out of the main bundle (they still SSR, so content and
// SEO are unchanged; their JS just loads after hydration starts).
const PinnedWorkflow = dynamic(() => import("./PinnedWorkflow").then((m) => m.PinnedWorkflow));
const PinnedUseCases = dynamic(() => import("./PinnedUseCases").then((m) => m.PinnedUseCases));

// Below-the-fold innerHTML blocks skip layout/paint until they near the
// viewport; the intrinsic size keeps the scrollbar stable.
const cvAuto: React.CSSProperties = { contentVisibility: "auto", containIntrinsicSize: "auto 1200px" };

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
        <SocialProof />
        <Marquee />
        <StatementSection />
        <div style={cvAuto} data-cv dangerouslySetInnerHTML={{ __html: (restAfterStatement as { html: string }).html }} />
        <Features />
        <PinnedWorkflow />
        <div style={cvAuto} data-cv dangerouslySetInnerHTML={{ __html: (restB2a as { html: string }).html }} />
        <PinnedUseCases />
        <div style={cvAuto} data-cv dangerouslySetInnerHTML={{ __html: (restB2b as { html: string }).html }} />
      </div>
      <LandingEffects />
    </>
  );
}

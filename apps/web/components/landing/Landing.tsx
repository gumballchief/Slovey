"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AmbientBackground } from "./AmbientBackground";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { IntroLoader } from "./IntroLoader";
import { LandingEffects } from "./LandingEffects";
import navMarkup from "./nav.json";
import restA from "./rest-a.json";
import restB from "./rest-b.json";

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
        <div dangerouslySetInnerHTML={{ __html: (navMarkup as { html: string }).html }} />
        <Hero introDone={introDone || !!reduce} />
        <div dangerouslySetInnerHTML={{ __html: (restA as { html: string }).html }} />
        <Features />
        <div dangerouslySetInnerHTML={{ __html: (restB as { html: string }).html }} />
      </div>
      <LandingEffects />
    </>
  );
}

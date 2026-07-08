"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AmbientBackground } from "./AmbientBackground";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { IntroLoader } from "./IntroLoader";
import { LandingEffects } from "./LandingEffects";
import { Nav } from "./Nav";
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
        <Nav />
        <Hero introDone={introDone || !!reduce} />
        <div dangerouslySetInnerHTML={{ __html: (restA as { html: string }).html }} />
        <Features />
        <div dangerouslySetInnerHTML={{ __html: (restB as { html: string }).html }} />
      </div>
      <LandingEffects />
    </>
  );
}

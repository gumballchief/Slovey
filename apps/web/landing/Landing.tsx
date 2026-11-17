"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import Lenis from "lenis";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  GitPullRequest,
  Siren,
  ChatCircleText,
  Plus,
  ShieldCheck,
  GitBranch,
  Plugs,
  LockKeyOpen,
  SquaresFour,
} from "@phosphor-icons/react";
import { PLAN_IDS, PLANS, type Plan } from "@company-brain/core/plans";
import { ProductWindow, type TabId } from "./ProductWindow";
import "./landing.css";

const GITHUB = "https://github.com/gumballchief/slovey";
const INSTALL = "npm i -g slovey";
const EASE = [0.16, 1, 0.3, 1] as const;

/** Ramps as plain functions: framer hands array-form opacity maps to the browser's ViewTimeline, which ignores our offsets. */
const ramp = (a: number, b: number, from: number, to: number) => (v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return from + (to - from) * t;
};
const ease = (a: number, b: number, from: number, to: number) => (v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  const e = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * e;
};

function useStory<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return { ref, p: scrollYProgress };
}

/* ---------------- Shared bits ---------------- */

function InstallPill() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="sl-pill sl-pill--dark sl-pill--mono"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(INSTALL);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked: the command stays visible to copy by hand */
        }
      }}
      aria-label={`Copy install command: ${INSTALL}`}
    >
      {INSTALL}
      {copied ? <Check weight="bold" aria-hidden /> : <Copy aria-hidden />}
      <span className="sl-sr" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

function Pills() {
  return (
    <div className="sl-pills">
      <a href="/login" className="sl-pill sl-pill--light">
        Start free
      </a>
      <InstallPill />
    </div>
  );
}

/** Nav and bottom bar slide in after the reveal. */
function enter(phase: Phase, from: number, delay: number) {
  return {
    initial: phase === "done" ? false : ({ opacity: 0, y: from } as const),
    animate: phase !== "load" ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 1, delay, ease: EASE },
  };
}

function Nav({ phase }: { phase: Phase }) {
  return (
    <motion.header className="sl-nav" {...enter(phase, -16, 1.5)}>
      <a href="#top" className="sl-brand" aria-label="Slovey home">
        <img src="/brand/mark.png" alt="" className="sl-brand-mark" />
        <img src="/brand/wordmark.png" alt="Slovey" className="sl-brand-word" />
      </a>
      <nav className="sl-links" aria-label="Main">
        <a href="#memory">Memory</a>
        <a href="#demo">Product</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </nav>
      <div className="sl-nav-pills">
        <a href="/login" className="sl-npill sl-npill--light">
          Sign in
        </a>
        <a href={GITHUB} target="_blank" rel="noreferrer" className="sl-npill">
          GitHub <span className="sl-npill-dot" aria-hidden />
        </a>
      </div>
    </motion.header>
  );
}

function BottomBar({ phase }: { phase: Phase }) {
  return (
    <motion.div className="sl-bar" {...enter(phase, 16, 1.75)}>
      <div className="sl-bar-side">
        <SquaresFour aria-hidden className="sl-bar-ico" />
        <span>
          Memory for coding agents.
          <br />
          Open source under MIT.
        </span>
      </div>
      <a href="/login" className="sl-bar-cta">
        <img src="/brand/mark.png" alt="" />
        <span>Start free</span>
      </a>
      <div className="sl-bar-side sl-bar-side--right">
        <span>
          Every decision,
          <br />
          on the record.
        </span>
      </div>
    </motion.div>
  );
}

/* ---------------- Opening: only the caught bug glows in the dark, then the camera pulls back ---------------- */

type Phase = "load" | "reveal" | "done";
const PRELOAD = ["/art/hero.webp", "/art/dive.webp"];
// Where the caught bug sits in hero.webp (1536 x 1024), and how the image is laid out by CSS.
const BUG = { x: 868, y: 700, w: 1536, h: 1024, shiftVh: 0.11 };

/** Plays on every load like SPARK's intro: counter over the glowing bug, then the reveal. */
function useIntro() {
  const [phase, setPhase] = useState<Phase>("load");
  const [pct, setPct] = useState(0);
  const [focus, setFocus] = useState({ x: 0, y: 0, cx: 0, cy: 0 });
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const k = Math.max(W / BUG.w, H / BUG.h);
    setFocus({ x: (W - BUG.w * k) / 2 + BUG.x * k, y: H - BUG.h * k + H * BUG.shiftVh + BUG.y * k, cx: W / 2, cy: H / 2 });
    const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(window.location.search).has("still");
    if (skip) {
      setPhase("done");
      setPct(100);
      return;
    }
    const root = document.documentElement;
    root.style.overflow = "hidden";
    let loaded = 0;
    PRELOAD.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
      };
      img.src = src;
    });
    const start = performance.now();
    let raf = 0;
    const timers: number[] = [];
    const tick = () => {
      const t = (performance.now() - start) / 1700;
      const ready = loaded >= PRELOAD.length || t > 2.6;
      const v = Math.min(1, ready ? t : Math.min(t, 0.9));
      setPct(Math.round(v * 100));
      if (v >= 1) {
        setPhase("reveal");
        timers.push(
          window.setTimeout(() => {
            setPhase("done");
            root.style.overflow = "";
          }, 2300),
        );
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      root.style.overflow = "";
    };
  }, []);
  return { phase, pct, focus };
}

const INTRO = { pull: 2.1, delay: 0.05 };

/* ---------------- Scene 1 + 2: the terminal catches the bug, then we dive through the clouds ---------------- */

function Hero({ phase, pct, focus }: ReturnType<typeof useIntro>) {
  const { ref, p } = useStory<HTMLElement>();
  const reduce = useReducedMotion();
  const heroScale = useTransform(p, ease(0, 0.46, 1, 2.1));
  const heroO = useTransform(p, ramp(0.3, 0.46, 1, 0));
  const copyO = useTransform(p, ramp(0, 0.12, 1, 0));
  const copyY = useTransform(p, ease(0, 0.2, 0, -90));
  const diveO = useTransform(p, ramp(0.34, 0.5, 0, 1));
  const diveScale = useTransform(p, ease(0.34, 0.9, 1.45, 1));
  const dCopyO = useTransform(p, ramp(0.52, 0.64, 0, 1));
  const dCopyY = useTransform(p, ease(0.52, 0.7, 40, 0));
  const open = phase !== "load";
  const line = (d: number) => ({
    initial: reduce || phase === "done" ? false : ({ opacity: 0, y: 30, filter: "blur(8px)" } as const),
    animate: open ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined,
    transition: { duration: 1.2, delay: 1.15 + d, ease: EASE },
  });
  const origin = `${focus.x}px ${focus.y}px`;
  // Until the screen is measured, keep everything black; then remount so the intro starts in the right place.
  const measured = focus.cx > 0;
  const mk = measured ? "m" : "u";
  return (
    <section className="sl-hero" id="top" ref={ref}>
      <div className="sl-stage">
        <motion.div
          key={`pull-${mk}`}
          className="sl-hero-pull"
          style={{ transformOrigin: origin }}
          initial={reduce || phase === "done" ? false : { scale: 3.2, x: focus.cx - focus.x, y: focus.cy - focus.y }}
          animate={open ? { scale: 1, x: 0, y: 0 } : { x: focus.cx - focus.x, y: focus.cy - focus.y }}
          transition={{ duration: INTRO.pull, delay: INTRO.delay, ease: [0.7, 0, 0.2, 1] }}
        >
          <motion.img src="/art/hero.webp" alt="" className="sl-hero-art" style={{ y: "11vh", scale: heroScale, opacity: heroO }} fetchPriority="high" />
        </motion.div>
        {phase !== "done" && (
          <motion.div
            key={`iris-${mk}`}
            className={`sl-iris ${measured ? "" : "is-closed"}`}
            aria-hidden
            initial={{ "--r": measured ? "0vmax" : "0vmax", "--fx": `${focus.cx}px`, "--fy": `${focus.cy}px` } as never}
            animate={(open ? { "--r": "190vmax", "--fx": `${focus.x}px`, "--fy": `${focus.y}px` } : { "--r": "9vmax", "--fx": `${focus.cx}px`, "--fy": `${focus.cy}px` }) as never}
            transition={open ? { duration: INTRO.pull * 0.95, delay: INTRO.delay, ease: [0.6, 0, 0.25, 1] } : { duration: 1.6, ease: EASE }}
          >
            <motion.span className="sl-iris-pct" animate={{ opacity: open ? 0 : 1 }} transition={{ duration: 0.4 }}>
              {pct}%
            </motion.span>
          </motion.div>
        )}
        <motion.img src="/art/dive.webp" alt="" className="sl-dive-art" style={{ scale: diveScale, opacity: diveO }} />
        <motion.div className="sl-hero-copy" style={{ opacity: copyO, y: copyY }}>
          <motion.p className="sl-eyebrow" {...line(0.1)}>
            Memory for coding agents
          </motion.p>
          <h1 className="sl-display">
            <motion.span {...line(0.2)}>Your agents forget.</motion.span>
            <motion.span {...line(0.32)}>Slovey remembers.</motion.span>
          </h1>
          <motion.p className="sl-lede" {...line(0.46)}>
            Slovey learns your team&rsquo;s decisions from GitHub and stops any change that breaks one, with the PR it came from.
          </motion.p>
          <motion.div {...line(0.6)}>
            <Pills />
          </motion.div>
        </motion.div>
        <motion.div className="sl-dive-copy" style={{ opacity: dCopyO, y: dCopyY }}>
          <p className="sl-eyebrow">Every decision</p>
          <h2 className="sl-display sl-display--md">
            Nothing your team
            <br />
            decided gets lost.
          </h2>
          <p className="sl-lede">Slovey reads every pull request, review and incident, and keeps the calls that last.</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------- Scene 3: the things it remembers fall into the drawer ---------------- */

// Code editor, terminal, blocked PR, approved PR, commit graph, </>, AI chip, cursor.
const OBJECTS = [
  { src: "/art/obj-4.webp", w: 150, x: -38, y: 8 },
  { src: "/art/obj-0.webp", w: 230, x: -26, y: -8 },
  { src: "/art/obj-3.webp", w: 196, x: -9, y: -16 },
  { src: "/art/obj-1.webp", w: 190, x: 9, y: -15 },
  { src: "/art/obj-2.webp", w: 196, x: 26, y: -6 },
  { src: "/art/obj-6.webp", w: 110, x: 38, y: 9 },
  { src: "/art/obj-5.webp", w: 150, x: -17, y: 14 },
  { src: "/art/obj-7.webp", w: 84, x: 17, y: 15 },
];

function FloatingObject({ o, i, p }: { o: (typeof OBJECTS)[number]; i: number; p: MotionValue<number> }) {
  const delay = i * 0.018;
  const x = useTransform(p, ease(0.3 + delay, 0.62 + delay, o.x, o.x * 0.18));
  const y = useTransform(p, ease(0.3 + delay, 0.62 + delay, o.y, 30));
  const s = useTransform(p, ease(0.3 + delay, 0.62 + delay, 1, 0.42));
  const r = useTransform(p, ease(0.3 + delay, 0.62 + delay, 0, (i % 2 ? 1 : -1) * 24));
  const o2 = useTransform(p, ramp(0.5 + delay, 0.64 + delay, 1, 0));
  const tx = useTransform(x, (v) => `${v}vw`);
  const ty = useTransform(y, (v) => `${v}vh`);
  return (
    <motion.div className="sl-obj" style={{ x: tx, y: ty, scale: s, rotate: r, opacity: o2, width: `calc(${o.w}px * var(--obj-k))` }}>
      <img src={o.src} alt="" style={{ animationDelay: `${i * -0.7}s` }} />
    </motion.div>
  );
}

function Objects() {
  const { ref, p } = useStory<HTMLElement>();
  const headO = useTransform(p, ramp(0.02, 0.14, 0, 1));
  const headY = useTransform(p, ease(0.02, 0.2, 30, 0));
  const drawerY = useTransform(p, ease(0.36, 0.7, 60, 0));
  const drawerO = useTransform(p, ramp(0.36, 0.52, 0, 1));
  const capO = useTransform(p, ramp(0.7, 0.8, 0, 1));
  const drawerTy = useTransform(drawerY, (v) => `${v}vh`);
  return (
    <section className="sl-objects" id="memory" ref={ref}>
      <div className="sl-stage">
        <motion.div className="sl-objects-head" style={{ opacity: headO, y: headY }}>
          <p className="sl-eyebrow">What it keeps</p>
          <h2 className="sl-display sl-display--md">
            Everything your team
            <br />
            already decided.
          </h2>
        </motion.div>
        <div className="sl-arc">
          {OBJECTS.map((o, i) => (
            <FloatingObject key={o.src} o={o} i={i} p={p} />
          ))}
        </div>
        <motion.img src="/art/laptop.webp" alt="Pull requests, code and commits being pulled into a laptop's memory" className="sl-drawer" style={{ y: drawerTy, opacity: drawerO }} />
        <motion.p className="sl-objects-cap" style={{ opacity: capO }}>
          Pull requests, reviews, commits and incidents go in. What comes out is a memory your agents can ask.
        </motion.p>
      </div>
    </section>
  );
}

/* ---------------- Scene 4: a hand of cards, then the whole history flies past ---------------- */

type Card = { kind: "text"; tag: string; title: string; body: string; Icon: typeof GitPullRequest } | { kind: "art"; src: string; tag: string };

const HAND: Card[] = [
  { kind: "text", tag: "PR #418", title: "Pull requests", body: "Every merged PR becomes a decision, with its reason attached.", Icon: GitPullRequest },
  { kind: "art", src: "/art/card-blocked.webp", tag: "Change blocked" },
  { kind: "text", tag: "INC-2207", title: "Incidents", body: "A postmortem becomes the reason a rule exists.", Icon: Siren },
  { kind: "art", src: "/art/card-caught.webp", tag: "Bug caught" },
  { kind: "text", tag: "Review on #455", title: "Reviews", body: "When a reviewer says no, the rule gets sharper.", Icon: ChatCircleText },
];

function CardFace({ c }: { c: Card }) {
  if (c.kind === "art") {
    return (
      <div className="sl-card sl-card--art">
        <img src={c.src} alt="" loading="lazy" />
        <span className="sl-card-tag">{c.tag}</span>
      </div>
    );
  }
  const Icon = c.Icon;
  return (
    <div className="sl-card">
      <div className="sl-card-top">
        <span className="sl-card-tag sl-card-tag--plain">{c.tag}</span>
        <p>{c.body}</p>
      </div>
      <div className="sl-card-mid" aria-hidden>
        <span className="sl-ring sl-ring--1" />
        <span className="sl-ring sl-ring--2" />
        <Icon weight="light" className="sl-card-ico" />
      </div>
      <h3 className="sl-card-title">{c.title}</h3>
    </div>
  );
}

function HandCard({ c, i, p }: { c: Card; i: number; p: MotionValue<number> }) {
  const d = i - 2;
  const x = useTransform(p, (v) => {
    const fan = ease(0.04, 0.32, d * 12, d * 252)(v);
    const fly = ease(0.56, 0.86, 0, d * 420)(v);
    return fan + fly;
  });
  const y = useTransform(p, (v) => ease(0.04, 0.32, Math.abs(d) * 4, Math.abs(d) * 26)(v) + ease(0.56, 0.86, 0, -160 - Math.abs(d) * 40)(v));
  const rotate = useTransform(p, (v) => ease(0.04, 0.32, d * 2, d * 7)(v) + ease(0.56, 0.86, 0, d * 10)(v));
  const scale = useTransform(p, ease(0.56, 0.86, 1, 1.7));
  const opacity = useTransform(p, ramp(0.72, 0.86, 1, 0));
  return (
    <motion.div className="sl-hand-card" style={{ x, y, rotate, scale, opacity, zIndex: 10 - Math.abs(d) }}>
      <CardFace c={c} />
    </motion.div>
  );
}

const FIELD = [
  "PR #512 Retry charges",
  "ADR-012 Drop Redux",
  "INC-2207",
  "PR #287 ChargeGateway",
  "Review on #455",
  "PR #301 Rate limits",
  "INC-1980",
  "PR #418 Cap retries",
  "ADR-019 One queue",
  "PR #366 Idempotency",
  "Review on #470",
  "PR #229 Feature flags",
  "INC-2311",
  "PR #402 Auth tokens",
];

function FieldCard({ label, i, p }: { label: string; i: number; p: MotionValue<number> }) {
  const lane = i % 2 ? 1 : -1;
  const sx = lane * (12 + ((i * 37) % 26));
  const sy = ((i * 53) % 50) - 25;
  const z = useTransform(p, (v) => -2600 + ((v - 0.55) / 0.45) * 3400 + i * 140);
  const opacity = useTransform(z, (zz) => (zz < -2400 ? 0 : zz > 600 ? Math.max(0, 1 - (zz - 600) / 300) : Math.min(1, (zz + 2400) / 600)));
  const transform = useTransform(z, (zz) => `translate3d(${sx}vw, ${sy}vh, ${zz}px)`);
  const art = i % 4 === 1 ? "/art/card-blocked.webp" : i % 4 === 3 ? "/art/card-caught.webp" : null;
  return (
    <motion.div className={`sl-fcard ${art ? "sl-fcard--art" : ""}`} style={{ transform, opacity }}>
      {art ? <img src={art} alt="" loading="lazy" /> : <span className="sl-fcard-ring" aria-hidden />}
      <span className="sl-fcard-label">{label}</span>
    </motion.div>
  );
}

function Hand() {
  const { ref, p } = useStory<HTMLElement>();
  const headO = useTransform(p, (v) => ramp(0, 0.1, 0, 1)(v) * ramp(0.5, 0.6, 1, 0)(v));
  const endO = useTransform(p, ramp(0.86, 0.96, 0, 1));
  const endY = useTransform(p, ease(0.86, 1, 30, 0));
  const fieldO = useTransform(p, (v) => ramp(0.52, 0.6, 0, 1)(v) * ramp(0.86, 0.95, 1, 0)(v));
  return (
    <section className="sl-handsec" ref={ref}>
      <div className="sl-stage">
        <motion.div className="sl-hand-head" style={{ opacity: headO }}>
          <p className="sl-eyebrow">Where it learns</p>
          <h2 className="sl-display sl-display--md">
            Learned from
            <br />
            your own history.
          </h2>
        </motion.div>
        <motion.div className="sl-field" style={{ opacity: fieldO }} aria-hidden>
          {FIELD.map((f, i) => (
            <FieldCard key={f} label={f} i={i} p={p} />
          ))}
        </motion.div>
        <div className="sl-hand">
          {HAND.map((c, i) => (
            <HandCard key={i} c={c} i={i} p={p} />
          ))}
        </div>
        <motion.div className="sl-hand-end" style={{ opacity: endO, y: endY }}>
          <p className="sl-eyebrow">All of it</p>
          <h2 className="sl-display sl-display--md">
            One question
            <br />
            away.
          </h2>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------- Scene 5: the product, stopping a change ---------------- */

const STEPS: { id: TabId; title: string; body: string }[] = [
  { id: "preflight", title: "Before the commit", body: "Preflight stops the change on the machine that made it." },
  { id: "pr", title: "On the pull request", body: "The GitHub App says which decision it breaks, and why." },
  { id: "ask", title: "Whenever anyone asks", body: "People and agents get the answer with the PR behind it." },
];

function Demo() {
  const { ref, p } = useStory<HTMLElement>();
  const [tab, setTab] = useState<TabId>("preflight");
  const [manual, setManual] = useState(false);
  const winY = useTransform(p, ease(0, 0.22, 90, 0));
  const winO = useTransform(p, ramp(0, 0.14, 0, 1));
  useMotionValueEvent(p, "change", (v) => {
    if (manual) return;
    const next: TabId = v < 0.42 ? "preflight" : v < 0.7 ? "pr" : "ask";
    setTab((t) => (t === next ? t : next));
  });
  const step = STEPS.find((s) => s.id === tab)!;
  return (
    <section className="sl-demo" id="demo" ref={ref}>
      <div className="sl-stage sl-demo-stage">
        <img src="/art/card-caught.webp" alt="" className="sl-demo-glow" aria-hidden />
        <div className="sl-demo-head">
          <p className="sl-eyebrow">The product</p>
          <h2 className="sl-display sl-display--sm">Watch it stop a change.</h2>
        </div>
        <motion.div className="sl-demo-win" style={{ y: winY, opacity: winO }}>
          <ProductWindow
            tab={tab}
            onTab={(t) => {
              setManual(true);
              setTab(t);
            }}
          />
        </motion.div>
        <div className="sl-demo-cap" aria-live="polite">
          <div className="sl-steps" aria-hidden>
            {STEPS.map((s) => (
              <span key={s.id} className={s.id === tab ? "is-on" : ""} />
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scene 6: bento ---------------- */

/** Real product moments, drawn as UI rather than metaphors. */
function UiPreflight() {
  return (
    <div className="ui ui-term">
      <div>
        <span className="ui-dim">$</span> slovey preflight
      </div>
      <div className="ui-dim">6 files, 214 decisions</div>
      <div className="ui-bad">
        <span className="ui-x">Blocked</span> retry.ts:22 breaks #418
      </div>
      <div className="ui-dim">5 files clear</div>
    </div>
  );
}
function UiPr() {
  return (
    <div className="ui ui-pr">
      <div className="ui-pr-row">
        <GitPullRequest weight="bold" className="ui-blue" aria-hidden />
        <span>Retry failed charges more aggressively</span>
      </div>
      <div className="ui-check ui-check--bad">
        <span className="ui-badge ui-badge--bad">1 conflict</span> Slovey decisions
      </div>
      <div className="ui-check">
        <span className="ui-badge">Passed</span> Tests, lint, build
      </div>
    </div>
  );
}
function UiAsk() {
  return (
    <div className="ui ui-ask">
      <div className="ui-q">Why do charge retries stop at 3?</div>
      <div className="ui-a">
        Because of INC-2207: retries ran 8 times during a processor timeout and some cards were charged twice. PR #418 capped them at 3.
      </div>
      <div className="ui-cites">
        <span>PR #418</span>
        <span className="is-bad">INC-2207</span>
        <span>Decision: retries stay at 3</span>
      </div>
    </div>
  );
}
function UiMcp() {
  return (
    <div className="ui ui-mcp">
      <div className="ui-agent">
        <img src="/logos/claude.svg" alt="" /> Claude Code
        <span className="ui-dim">asks before writing</span>
      </div>
      <code>slovey.decisions(&quot;charge retries&quot;)</code>
      <div className="ui-ret">
        <span className="ui-blue">returns</span> #418, retries stay at 3
      </div>
    </div>
  );
}
function UiRepo() {
  return (
    <div className="ui ui-repo">
      <div className="ui-pr-row">
        <GitBranch weight="bold" className="ui-blue" aria-hidden />
        <span>gumballchief/slovey</span>
      </div>
      <div className="ui-tags">
        <span>MIT</span>
        <span>TypeScript</span>
        <span>Self-host</span>
      </div>
      <code>{INSTALL}</code>
    </div>
  );
}

const TILES = [
  { cls: "t-a", art: "/art/tile-preflight.webp", Ui: UiPreflight, Icon: ShieldCheck, k: "Preflight", title: "Stops it before the commit", body: "Runs on your machine and blocks a change that breaks a decision." },
  { cls: "t-b", art: "/art/tile-pr.webp", Ui: UiPr, Icon: GitPullRequest, k: "GitHub App", title: "Reviews every pull request", body: "Cites the decision and the PR behind it, right in the review." },
  { cls: "t-c", art: "/art/tile-ask.webp", Ui: UiAsk, Icon: ChatCircleText, k: "Ask", title: "Answers why it was built this way", body: "Every claim links to the PR, review or postmortem it came from." },
  { cls: "t-d", art: "/art/tile-mcp.webp", Ui: UiMcp, Icon: Plugs, k: "MCP server", title: "Your agents ask first", body: "Claude, Codex, Cursor and any MCP client check Slovey before they write." },
  { cls: "t-e", art: "/art/tile-repo.webp", Ui: UiRepo, Icon: LockKeyOpen, k: "Open source", title: "Yours to run", body: "MIT licensed. Self-host it, or let us run it." },
];

function Bento() {
  return (
    <section className="sl-bento-sec">
      <div className="sl-wrap">
        <Reveal className="sl-center">
          <p className="sl-eyebrow">Under every agent</p>
          <h2 className="sl-display sl-display--md">
            One memory.
            <br />
            Wherever code gets written.
          </h2>
        </Reveal>
        <div className="sl-bento">
          {TILES.map((t, i) => (
            <Reveal key={t.k} delay={i * 0.06} className={`sl-tile ${t.cls}`}>
              <img src={t.art} alt="" className="sl-tile-art" loading="lazy" />
              <div className="sl-tile-ui">
                <t.Ui />
              </div>
              <div className="sl-tile-copy">
                <span className="sl-tile-k">
                  <t.Icon aria-hidden /> {t.k}
                </span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`sl-reveal ${className}`}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Pricing + FAQ ---------------- */

/** The plan the pricing grid lights up (gets the art and the light button). */
const FEATURED = "team";

function planPrice(p: Plan, annual: boolean): string {
  if (!p.price) return "Custom";
  return `$${annual ? p.price.annual : p.price.monthly}`;
}

/** What actually gets charged, so "$799 per month" billed yearly can't be misread. */
function planBilled(p: Plan, annual: boolean): string {
  if (p.billing === "free") return "No card needed";
  if (!p.price) return "Priced for your org";
  if (!annual) return "Billed monthly, cancel anytime";
  const year = (p.price.annual * 12).toLocaleString("en-US");
  return p.billing === "seat" ? `$${year} per user, billed yearly` : `$${year} billed yearly`;
}

function planUnit(p: Plan): string {
  if (p.billing === "free") return "forever";
  if (p.billing === "seat") return "per user / month";
  if (p.billing === "flat") return `per month, up to ${p.users} users`;
  return "";
}

function Pricing() {
  const [annual, setAnnual] = useState(true);
  const interval = annual ? "annual" : "monthly";
  return (
    <section className="sl-pricing" id="pricing">
      <div className="sl-wrap">
        <Reveal className="sl-center">
          <p className="sl-eyebrow">Pricing</p>
          <h2 className="sl-display sl-display--md">
            Free for one engineer.
            <br />A plan for every team.
          </h2>
          <div className="sl-toggle" role="group" aria-label="Billing period">
            <button type="button" className={annual ? "is-on" : ""} onClick={() => setAnnual(true)} aria-pressed={annual}>
              Yearly <em>save 20%</em>
            </button>
            <button type="button" className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)} aria-pressed={!annual}>
              Monthly
            </button>
          </div>
        </Reveal>
        <div className="sl-plans">
          {PLAN_IDS.map((id, i) => {
            const p = PLANS[id];
            const featured = id === FEATURED;
            const price = planPrice(p, annual);
            const unit = planUnit(p);
            return (
              <Reveal key={id} delay={0.06 * (i % 3)} className={`sl-plan ${featured ? "is-featured" : ""}`}>
                {featured && <img src="/art/dive.webp" alt="" className="sl-plan-art" loading="lazy" />}
                <div className="sl-plan-body">
                  <h3>{p.name}</h3>
                  <p className="sl-plan-who">{p.who}</p>
                  <div className="sl-plan-price">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={price} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3, ease: EASE }}>
                        {price}
                      </motion.span>
                    </AnimatePresence>
                    {unit && <small>{unit}</small>}
                  </div>
                  <p className="sl-plan-bill">{planBilled(p, annual)}</p>
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check weight="bold" aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  {p.billing === "custom" ? (
                    <a href="mailto:support@slovey.dev?subject=Slovey%20Enterprise" className="sl-pill sl-pill--dark sl-pill--wide">
                      Contact sales <ArrowUpRight weight="bold" aria-hidden />
                    </a>
                  ) : p.billing === "free" ? (
                    <a href="/login" className="sl-pill sl-pill--dark sl-pill--wide">
                      Start free <ArrowRight weight="bold" aria-hidden />
                    </a>
                  ) : (
                    <a href={`/login?plan=${id}&interval=${interval}`} className={`sl-pill sl-pill--wide ${featured ? "sl-pill--light" : "sl-pill--dark"}`}>
                      Get {p.name} plan <ArrowRight weight="bold" aria-hidden />
                    </a>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "Does this replace Claude Code or Cursor?", a: "No. Slovey sits under them. Your agents keep writing code the way they do today, and Slovey checks each change against your team's decisions before it is committed or merged." },
  { q: "How does it learn my team's decisions?", a: "It reads your GitHub history: pull requests, reviews, commits and docs, plus resolved PagerDuty incidents and their postmortem notes. It keeps the decisions that last and links each one to the PR it came from." },
  { q: "What leaves my machine when Preflight runs?", a: "Builds and tests run locally. In hosted mode Slovey receives the diff, the contents of the changed files, and the branch and commit. If the hosted service is down, Preflight warns and lets you continue, and the GitHub App checks again at PR time." },
  { q: "How do agents use the memory?", a: "Through the MCP server. Claude, Codex, Cursor and any MCP client can ask Slovey about decisions, architecture and rules before they write, instead of re-learning your codebase every session." },
  { q: "Is it open source?", a: "Yes, under the MIT license. The code is on GitHub. Enterprise adds self-hosted and VPC deployments with audit logs." },
  { q: "How long until it is useful?", a: "You can connect a repository in a few minutes. Basic checks work on day one, and the memory gets sharper with every review, merge and correction your team makes." },
];

function Faq() {
  const [open, setOpen] = useState(0);
  const reduce = useReducedMotion();
  return (
    <section className="sl-faq" id="faq">
      <div className="sl-wrap sl-faq-wrap">
        <Reveal className="sl-center">
          <p className="sl-eyebrow">Questions</p>
          <h2 className="sl-display sl-display--sm">Asked and answered.</h2>
        </Reveal>
        <div className="sl-faq-list">
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className={`sl-faq-item ${on ? "is-open" : ""}`}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)}>
                  <span>{f.q}</span>
                  <Plus className="sl-faq-ico" weight="light" aria-hidden />
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="sl-faq-a">
                      <p>{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Closing: the terminal on the lake, and one big line to start ---------------- */

function Closing() {
  const { ref, p } = useStory<HTMLElement>();
  const artScale = useTransform(p, ease(0, 0.6, 1.18, 1));
  const artO = useTransform(p, ramp(0, 0.3, 0.2, 1));
  return (
    <section className="sl-closing" ref={ref}>
      <div className="sl-closing-scene">
        <motion.img src="/art/closing.webp" alt="" className="sl-closing-art" style={{ scale: artScale, opacity: artO }} loading="lazy" />
        <div className="sl-closing-copy">
          <img src="/brand/mark.png" alt="" className="sl-closing-mark" />
          <p className="sl-eyebrow">Stay ahead of your agents</p>
          <h2 className="sl-display">
            Give your agents
            <br />
            a memory.
          </h2>
        </div>
      </div>
      <div className="sl-wrap">
        <a href="/login" className="sl-bigline">
          <span>Start free</span>
          <ArrowRight weight="thin" aria-hidden />
        </a>
        <p className="sl-bigline-sub">One repository free, forever. Or install the CLI: {INSTALL}</p>
        <footer className="sl-foot">
          <img src="/brand/wordmark.png" alt="Slovey" className="sl-foot-word" />
          <span>&copy; {new Date().getFullYear()} Slovey</span>
          <div className="sl-foot-links">
            <a href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://x.com/SloveyAI" target="_blank" rel="noreferrer">
              X
            </a>
            <a href="https://www.instagram.com/sloveyai/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="mailto:support@slovey.dev">support@slovey.dev</a>
          </div>
        </footer>
      </div>
    </section>
  );
}

export function Landing() {
  const reduce = useReducedMotion();
  const intro = useIntro();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("still")) document.documentElement.classList.add("sl-still");
    if (reduce) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduce]);

  return (
    <div className="sl">
      <Nav phase={intro.phase} />
      <main>
        <Hero {...intro} />
        <Objects />
        <Hand />
        <Demo />
        <Bento />
        <Pricing />
        <Faq />
      </main>
      <Closing />
      <BottomBar phase={intro.phase} />
      <div className="sl-grain" aria-hidden />
    </div>
  );
}

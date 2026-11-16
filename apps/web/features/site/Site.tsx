import "@/ui/ui.css";
import "./site.css";
import { ArrowRightIcon, GithubLogoIcon, InstagramLogoIcon, XLogoIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

/* Shared frame for every public page that isn't the landing: same world (navy-black,
   screen-print art, Bellefair caps), but a calm reading layout. Server components. */

export const GITHUB_URL = "https://github.com/gumballchief/slovey";
export const X_URL = "https://x.com/SloveyAI";
export const INSTAGRAM_URL = "https://www.instagram.com/sloveyai/";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/mcp", label: "MCP" },
  { href: "/security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

function Mark({ size = 28 }: { size?: number }) {
  return (
    <span className="ui-mark" style={{ width: size, height: size }} aria-hidden>
      <img src="/brand/tile-white.png" alt="" width={size} height={size} />
      <img src="/brand/dot-red.png" alt="" width={size} height={size} />
    </span>
  );
}

export function SiteNav() {
  return (
    <header className="st-nav">
      <Link href="/" className="st-brand" aria-label="Slovey home">
        <Mark />
        Slovey
      </Link>
      <nav className="st-links" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="st-actions">
        <Link href="/login" className="st-signin">
          Sign in
        </Link>
        <Link href="/login?mode=signup" className="ui-btn ui-btn--light ui-btn--sm">
          Start free
        </Link>
      </div>
    </header>
  );
}

const FOOT = [
  {
    title: "Product",
    links: [
      ["Docs", "/docs"],
      ["MCP server", "/mcp"],
      ["API", "/api-reference"],
      ["Integrations", "/integrations"],
      ["Live demo", "/demo"],
      ["Changelog", "/changelog"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
      ["Security", "/security"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="st-foot">
      <div className="st-foot-top">
        <div className="st-foot-brand">
          <Link href="/" className="st-brand">
            <Mark size={30} />
            Slovey
          </Link>
          <p>Memory for your coding agents. Open source, MIT licensed.</p>
          <a className="st-gh" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <GithubLogoIcon size={16} weight="fill" /> Star on GitHub
          </a>
          <div className="st-social">
            <a href={X_URL} target="_blank" rel="noreferrer">
              <XLogoIcon size={16} weight="bold" /> @SloveyAI
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
              <InstagramLogoIcon size={16} weight="bold" /> Instagram
            </a>
          </div>
        </div>
        {FOOT.map((col) => (
          <div key={col.title} className="st-foot-col">
            <div className="ui-label">{col.title}</div>
            {col.links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="st-foot-bottom">
        <span>© {new Date().getFullYear()} Slovey</span>
        <span>Made for teams that ship with AI.</span>
      </div>
    </footer>
  );
}

/** A public page: art-backed hero band, then a reading column (or a wide one). */
export function SitePage({
  eyebrow,
  title,
  lede,
  art = "/art/dive.webp",
  wide,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  art?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ui st">
      <SiteNav />
      <section className="st-hero">
        <img className="st-hero-art" src={art} alt="" aria-hidden />
        <div className="st-hero-shade" aria-hidden />
        <div className="st-hero-in">
          <div className="ui-eyebrow">{eyebrow}</div>
          <h1 className="ui-title st-title">{title}</h1>
          {lede && <p className="st-lede">{lede}</p>}
        </div>
      </section>
      <main className={wide ? "st-body st-body--wide" : "st-body"}>{children}</main>
      <SiteCta />
      <SiteFooter />
    </div>
  );
}

export function SiteCta() {
  return (
    <section className="st-cta">
      <h2 className="ui-title st-cta-title">
        Give your agents <span className="dim">your team&apos;s memory.</span>
      </h2>
      <div className="st-cta-actions">
        <Link href="/login?mode=signup" className="ui-btn ui-btn--light ui-btn--lg">
          Start free <ArrowRightIcon size={16} weight="bold" />
        </Link>
        <Link href="/docs" className="ui-btn ui-btn--lg">
          Read the docs
        </Link>
      </div>
    </section>
  );
}

/** Long-form text pages (privacy, terms, security): same frame, typeset prose. */
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <SitePage eyebrow={`Last updated ${updated}`} title={title} art="/art/closing.webp">
      <article className="st-prose">{children}</article>
    </SitePage>
  );
}

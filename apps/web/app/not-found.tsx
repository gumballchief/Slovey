import Link from "next/link";
import { SiteFooter, SiteNav } from "@/features/site/Site";

export default function NotFound() {
  return (
    <div className="ui st">
      <SiteNav />
      <section className="st-hero" style={{ minHeight: "72vh", alignItems: "center" }}>
        <img className="st-hero-art" src="/art/bug.webp" alt="" aria-hidden />
        <div className="st-hero-shade" aria-hidden />
        <div className="st-hero-in" style={{ justifyItems: "start" }}>
          <div className="ui-eyebrow">404</div>
          <h1 className="ui-title st-title">
            This page got away. <span className="dim">Nothing caught it.</span>
          </h1>
          <p className="st-lede">The link may be old, or the page moved.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <Link href="/" className="ui-btn ui-btn--light ui-btn--lg">
              Go home
            </Link>
            <Link href="/app" className="ui-btn ui-btn--lg">
              Open the dashboard
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

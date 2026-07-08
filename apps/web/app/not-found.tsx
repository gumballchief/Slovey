import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--cb-text)]">
      <PublicNav />
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-32 text-center">
        <p className="label-mono text-[var(--primary)]">404</p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">Page not found</h1>
        <p className="mt-4 max-w-md text-lg text-[var(--text-muted)]">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved. Let&rsquo;s get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Back home
          </a>
          <a
            href="/docs"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-2.5 font-medium text-[var(--cb-text)] transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Read the docs
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

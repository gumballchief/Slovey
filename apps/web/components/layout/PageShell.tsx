import { PublicNav } from "@/components/layout/PublicNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * Shared shell for the standalone marketing pages (docs, about, contact, …).
 * Public nav + a titled header + content + the site footer, in the landing's
 * light soft-blue theme and Bricolage display type. Not for legal pages —
 * those use LegalShell.
 */
export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="force-light flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--cb-text)]">
      <PublicNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-32 sm:px-8">
        <p className="label-mono text-[var(--primary)]">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">{title}</h1>
        {intro ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">{intro}</p> : null}
        {children ? <div className="mt-12">{children}</div> : null}
      </main>
      <SiteFooter />
    </div>
  );
}

/** A subtle "not shipped yet" note, styled on-brand. */
export function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-5 text-[15px] leading-relaxed text-[var(--text-muted)]">
      <span className="label-mono mr-2 text-[var(--primary)]">Coming soon</span>
      {children}
    </div>
  );
}

/** Simple bordered feature/link card used across the stub pages. */
export function InfoCard({
  title,
  children,
  href,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-[var(--cb-text)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{children}</p>
    </>
  );
  const cls =
    "block rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-5 transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

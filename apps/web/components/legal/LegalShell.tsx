import { PublicNav } from "@/components/layout/PublicNav";

/** Shared shell for legal pages: public nav, template disclaimer, styled prose. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="force-light min-h-dvh bg-[var(--bg)] text-[var(--cb-text)]">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8">
        <p className="label-mono text-[var(--text-muted)]">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated {updated}</p>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
          This document is a plain-language template provided for convenience — it is{" "}
          <strong className="text-[var(--cb-text)]">not legal advice</strong>. Have a qualified
          attorney review and adapt it (contacts, jurisdiction, specifics) before relying on it.
        </div>

        <article className="mt-8 text-[15px] leading-relaxed text-[color-mix(in_oklab,var(--cb-text)_88%,transparent)] [&_a]:text-[var(--primary)] [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-[var(--cb-text)] [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[var(--cb-text)] [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-[var(--cb-text)] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>
      </main>
    </div>
  );
}

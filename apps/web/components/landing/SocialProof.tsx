"use client";

/**
 * Proof band under the hero.
 *
 * Deliberately NOT customer logos or testimonials — there are no customers yet,
 * and inventing them on a product whose entire promise is "we block false claims"
 * would be self-refuting. Instead this shows the gate's real catch record: changes
 * it actually blocked, including against this codebase itself.
 *
 * Every line here must stay verifiable. If a catch is added, it happened.
 */

type Catch = {
  where: string;
  claimed: string;
  truth: string;
};

const CATCHES: Catch[] = [
  {
    where: "A README, written by an AI agent",
    claimed: "“Live on Solana mainnet”",
    truth: "The project was on devnet. The agent had believed the project's own marketing copy.",
  },
  {
    where: "Marketing copy vs. recorded network state",
    claimed: "Production-ready deployment",
    truth: "Contradicted a decision recorded weeks earlier. Forced a human ruling that corrected a stale decision.",
  },
  {
    where: "A price service, mid-refactor",
    claimed: "Real market data",
    truth: "The data was seeded fixtures. The decision was rescoped to match what actually shipped.",
  },
];

export function SocialProof() {
  return (
    <section
      aria-labelledby="proof-heading"
      style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "64px auto 0", padding: "0 24px" }}
    >
      <p
        id="proof-heading"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-muted, #9a95ab)",
          margin: 0,
          textAlign: "center",
        }}
      >
        No customers yet — here is what it has actually blocked
      </p>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {CATCHES.map((c) => (
          <article
            key={c.claimed}
            style={{
              borderRadius: 12,
              border: "1px solid var(--border, #e3e1ea)",
              background: "var(--bg-subtle, rgba(255,255,255,.55))",
              padding: "16px 16px 14px",
              textAlign: "left",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-muted, #a8a4b6)",
                margin: 0,
              }}
            >
              {c.where}
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--cb-text, #201c2b)",
                textDecoration: "line-through",
                textDecorationColor: "var(--text-muted, #a8a4b6)",
              }}
            >
              {c.claimed}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted, #6c6880)" }}>
              {c.truth}
            </p>
          </article>
        ))}
      </div>

      <p
        style={{
          marginTop: 16,
          textAlign: "center",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--text-muted, #9a95ab)",
        }}
      >
        Caught while gating real repositories — including this one.{" "}
        <a
          href="https://github.com/gumballchief/slovey"
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          The source is open
        </a>
        , so you can check.
      </p>
    </section>
  );
}

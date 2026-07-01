"use client"; // Error boundaries must be Client Components

// global-error replaces the root layout when the app crashes above it, so it
// must render its own <html>/<body>. Providing this also sidesteps the default
// global-error component, which fails to prerender under this Next version.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0f",
          color: "#e8e8ea",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main style={{ textAlign: "center", padding: "2rem", maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, margin: "0 0 1.5rem" }}>
            An unexpected error occurred. Try again, and if it persists, refresh the page.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "0.9375rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

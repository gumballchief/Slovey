"use client"; // Error boundaries must be Client Components

import "@/ui/ui.css";
import Link from "next/link";
import { useEffect } from "react";

/** A page crashed while rendering. Keep the brand, say it plainly, offer a retry. */
export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="ui"
      style={{ display: "grid", placeItems: "center", textAlign: "center", padding: "10vh 24px", minHeight: "70vh" }}
    >
      <div style={{ display: "grid", gap: 16, justifyItems: "center", maxWidth: 520 }}>
        <div className="ui-eyebrow">Something broke</div>
        <h1 className="ui-title">
          That didn&apos;t load. <span className="dim">It&apos;s on us.</span>
        </h1>
        <p className="ui-body ui-muted">
          Try again. If it keeps happening, tell us at support@slovey.dev
          {error.digest ? ` and mention code ${error.digest}` : ""}.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="ui-btn ui-btn--light" onClick={() => unstable_retry()}>
            Try again
          </button>
          <Link href="/" className="ui-btn">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

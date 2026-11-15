"use client";

/**
 * Last-resort error page, used only if the root layout itself fails. It replaces the whole
 * document, so global CSS and fonts aren't loaded: styles are inline (DESIGN.md §10 colours).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FDFDFC",
          color: "#111827",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 24,
        }}
      >
        <title>Something went wrong</title>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8007B" }}>Error</p>
          <h1 style={{ margin: "12px 0 8px", fontSize: 28, letterSpacing: "-0.02em" }}>The site couldn&apos;t load</h1>
          <p style={{ margin: "0 0 24px", color: "#5F6672", lineHeight: 1.6 }}>
            Please try again in a moment. If you were booking, no payment was taken unless you saw a confirmation.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ height: 48, padding: "0 24px", border: 0, borderRadius: 999, background: "#D6008F", color: "#fff", fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

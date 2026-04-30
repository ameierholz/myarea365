import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · MyArea365",
  description: "Du bist gerade offline. Verbinde dich neu, um weiterzulaufen.",
  robots: { index: false, follow: false },
};

/**
 * Offline-Fallback — wird vom Service-Worker bei fehlgeschlagener Navigation
 * angezeigt. Bewusst minimaler HTML-Output ohne externe Assets, damit die
 * Seite auch ohne Netz vollständig rendert.
 */
export default function OfflinePage() {
  return (
    <main role="main" aria-labelledby="offline-title" style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "#0F1115",
      color: "#F0F0F0",
      textAlign: "center",
      gap: "1.5rem",
    }}>
      <div aria-hidden="true" style={{ fontSize: "4rem" }}>📡</div>
      <h1 id="offline-title" style={{ fontSize: "1.75rem", fontWeight: 900 }}>Du bist offline</h1>
      <p style={{ maxWidth: 420, color: "#8B8FA3", lineHeight: 1.5 }}>
        Sobald du wieder Netz hast, geht’s weiter. Deine Lauf-Daten werden lokal
        gespeichert und automatisch hochgeladen.
      </p>
      <a
        href="/"
        style={{
          padding: "0.75rem 1.5rem",
          borderRadius: 12,
          background: "rgba(34,209,195,0.15)",
          border: "1px solid #22D1C3",
          color: "#22D1C3",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Neu versuchen
      </a>
    </main>
  );
}

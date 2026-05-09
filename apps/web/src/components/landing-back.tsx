import Link from "next/link";

/**
 * LandingBack — einheitlicher Zurück-Link am Anfang jeder öffentlichen Page.
 *
 * Pure Server-Component (keine Translations-Dependency damit es sowohl in
 * server- als auch client-trees funktioniert). Caller passt das Label durch:
 *   <LandingBack label={t("backToHome")} />
 *
 * Default-Ziel ist `/` — viele User kommen über Footer-Links / E-Mail-Links
 * direkt auf rechtliche Seiten und brauchen einen klaren Rückweg, nicht nur
 * browser-back (was bei direkten Links auf about:blank landet).
 */
export function LandingBack({
  href = "/",
  label = "← Zurück zur Startseite",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-text-muted hover:text-primary transition-colors group"
    >
      <span className="inline-block transition-transform group-hover:-translate-x-0.5" aria-hidden="true">←</span>
      <span>{label.replace(/^←\s*/, "")}</span>
    </Link>
  );
}

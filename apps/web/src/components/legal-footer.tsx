"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Kompakter Rechts-Footer mit Impressum, Datenschutz und AGB.
 * Wird auf der Marketing-Landingpage "/" ausgeblendet, da diese bereits
 * einen vollständigen Footer mit denselben Links besitzt.
 * Auf Admin-Seiten ebenfalls ausgeblendet (Admin hat eigenes Chrome).
 */
export function LegalFooter() {
  const pathname = usePathname() ?? "";

  if (pathname === "/" || pathname.startsWith("/admin")) return null;

  return (
    <footer
      className="border-t border-border/40 bg-bg/80 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-text-muted">
        <span>© {new Date().getFullYear()} MyArea365</span>
        <Link href="/impressum" className="hover:text-text transition-colors">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:text-text transition-colors">
          Datenschutz
        </Link>
        <Link href="/agb" className="hover:text-text transition-colors">
          AGB
        </Link>
        <a href="mailto:support@myarea365.de" className="hover:text-text transition-colors">
          Support
        </a>
      </div>
    </footer>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { openLegalModal } from "./legal-modal";

/**
 * Kompakter Rechts-Footer. Öffnet Impressum/Datenschutz/AGB als Modal.
 * Ausgeblendet auf Landing (eigener Footer), Dashboard und Admin.
 */
export function LegalFooter() {
  const pathname = usePathname() ?? "";

  if (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/shop-dashboard")
  ) return null;

  return (
    <footer
      className="border-t border-border/40 bg-bg/80 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-5 text-center text-[11px] text-text-muted leading-[1.8]">
        <div>© MyArea365 {new Date().getFullYear()} · Alle Rechte vorbehalten · v0.3</div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <LinkBtn onClick={() => openLegalModal("impressum")}>Impressum</LinkBtn>
          <span className="opacity-40">|</span>
          <LinkBtn onClick={() => openLegalModal("datenschutz")}>Datenschutz</LinkBtn>
          <span className="opacity-40">|</span>
          <LinkBtn onClick={() => openLegalModal("agb")}>AGB</LinkBtn>
          <span className="opacity-40">|</span>
          <a href="/support" className="hover:text-text transition-colors">Support</a>
        </div>
        <div>Made with ❤️ in Berlin</div>
      </div>
    </footer>
  );
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="hover:text-text transition-colors underline-offset-2 hover:underline"
      style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}
    >
      {children}
    </button>
  );
}

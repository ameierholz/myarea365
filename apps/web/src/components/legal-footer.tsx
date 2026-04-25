"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { openLegalModal } from "./legal-modal";

export function LegalFooter() {
  const t = useTranslations("LegalFooter");
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
        <div>{t("copyright", { year: new Date().getFullYear() })}</div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <LinkBtn onClick={() => openLegalModal("impressum")}>{t("impressum")}</LinkBtn>
          <span className="opacity-40">|</span>
          <LinkBtn onClick={() => openLegalModal("datenschutz")}>{t("privacy")}</LinkBtn>
          <span className="opacity-40">|</span>
          <LinkBtn onClick={() => openLegalModal("agb")}>{t("terms")}</LinkBtn>
          <span className="opacity-40">|</span>
          <a href="/support" className="hover:text-text transition-colors">{t("support")}</a>
        </div>
        <div>{t("made")}</div>
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

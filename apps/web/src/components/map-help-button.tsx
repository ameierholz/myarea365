"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FaqModal } from "@/components/faq-modal";
import { OnboardingModal, markOnboardingSeen } from "@/components/onboarding-modal";
import { MapLegendModal } from "@/components/map-legend-modal";

export function MapHelpButton({ inline = false }: { inline?: boolean } = {}) {
  const t = useTranslations("MapHelp");
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "onboarding" | "faq" | "legend">(null);

  return (
    <>
      <div style={inline
        ? { position: "relative", zIndex: 55 }
        : { position: "absolute", bottom: 8, right: 8, zIndex: 55 }
      }>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("ariaHelp")}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(15,17,21,0.85)",
            border: "1.5px solid rgba(34,209,195,0.5)",
            color: "#22D1C3", fontSize: 18, fontWeight: 900, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.5), 0 0 14px rgba(34,209,195,0.22)",
            backdropFilter: "blur(8px)",
          }}
        >?</button>

        {open && (
          <div style={{
            position: "absolute", bottom: 46, right: 0,
            minWidth: 200,
            background: "rgba(15,17,21,0.95)",
            border: "1px solid rgba(34,209,195,0.3)",
            borderRadius: 12,
            padding: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}>
            <button onClick={() => { setModal("onboarding"); setOpen(false); }} style={{
              display: "block", width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "transparent", border: "none",
              color: "#FFF", fontSize: 13, fontWeight: 700, textAlign: "left", cursor: "pointer",
            }}>{t("intro")}</button>
            <button onClick={() => { setModal("legend"); setOpen(false); }} style={{
              display: "block", width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "transparent", border: "none",
              color: "#FFF", fontSize: 13, fontWeight: 700, textAlign: "left", cursor: "pointer",
            }}>{t("legend")}</button>
            <button onClick={() => { setModal("faq"); setOpen(false); }} style={{
              display: "block", width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "transparent", border: "none",
              color: "#FFF", fontSize: 13, fontWeight: 700, textAlign: "left", cursor: "pointer",
            }}>{t("faq")}</button>
          </div>
        )}
      </div>

      {modal === "onboarding" && (
        <OnboardingModal onClose={() => { markOnboardingSeen(); setModal(null); }} />
      )}
      {modal === "faq" && <FaqModal onClose={() => setModal(null)} />}
      {modal === "legend" && <MapLegendModal onClose={() => setModal(null)} />}
    </>
  );
}

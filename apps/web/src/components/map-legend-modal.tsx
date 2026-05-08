"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

type Entry = { icon: string; label: string; desc: string; color: string };
type Section = { title: string; entries: Entry[] };

export function MapLegendModal({ onClose }: { onClose: () => void }) {
  const tL = useTranslations("MapLegend");
  const SECTIONS: Section[] = useMemo(() => [
    {
      title: tL("secProgress"),
      entries: [
        { icon: "🟡", color: "#FFD700", label: tL("ownAreaLabel"),    desc: tL("ownAreaDesc") },
        { icon: "🟦", color: "#22D1C3", label: tL("crewAreaLabel"),   desc: tL("crewAreaDesc") },
        { icon: "🔴", color: "#FF2D78", label: tL("enemyAreaLabel"),  desc: tL("enemyAreaDesc") },
        { icon: "⚪", color: "#FFD700", label: tL("pendingLabel"),    desc: tL("pendingDesc") },
      ],
    },
    {
      title: tL("secWorld"),
      entries: [
        { icon: "📍", color: "#FF6B4A", label: tL("shopLabel"),      desc: tL("shopDesc") },
        { icon: "⚔️", color: "#FFD700", label: tL("arenaLabel"),     desc: tL("arenaDesc") },
        { icon: "🔦", color: "#FFD700", label: tL("spotlightLabel"), desc: tL("spotlightDesc") },
        { icon: "🐉", color: "#FF2D78", label: tL("bossLabel"),      desc: tL("bossDesc") },
        { icon: "🏛️", color: "#22D1C3", label: tL("sanctumLabel"),   desc: tL("sanctumDesc") },
        { icon: "⚡", color: "#a855f7", label: tL("powerZoneLabel"), desc: tL("powerZoneDesc") },
        { icon: "💥", color: "#FF6B4A", label: tL("flashLabel"),     desc: tL("flashDesc") },
        { icon: "🏃", color: "#22D1C3", label: "Live-Runner",         desc: "Andere Runner, die gerade unterwegs sind. Farbe = ihre Crew-Fraktion." },
      ],
    },
    {
      title: "Basen & Kampf",
      entries: [
        { icon: "🏰", color: "#FFD700", label: "Deine Base",     desc: "Dein persönliches Hauptquartier — Klick öffnet Bau-Modal (Resourcen, Truppen, Forschung, Loot, Premium)." },
        { icon: "🏯", color: "#FF6B4A", label: "Crew-Base",      desc: "Hauptquartier deiner Crew — gemeinsame Forschung & Buffs." },
        { icon: "🛡", color: "#8B8FA3", label: "Fremde Base",    desc: "Base eines anderen Runners oder einer anderen Crew." },
        { icon: "🏚", color: "#FF2D78", label: "Wegelager",      desc: "Bandit-Festung (Lv 1–10). Nur per Crew-Angriff zu knacken — Loot proportional zum eigenen Beitrag." },
        { icon: "⚔️", color: "#FFD700", label: "Aktiver Crew-Angriff", desc: "Banner oben auf der Karte: deine Crew sammelt sich für einen Streifzug. Klick = beitreten." },
      ],
    },
    {
      title: tL("secLoot"),
      entries: [
        { icon: "📦", color: "#9ba8c7", label: tL("lootCommonLabel"), desc: tL("lootCommonDesc") },
        { icon: "🎁", color: "#5ddaf0", label: tL("lootRareLabel"),   desc: tL("lootRareDesc") },
        { icon: "💎", color: "#a855f7", label: tL("lootEpicLabel"),   desc: tL("lootEpicDesc") },
        { icon: "👑", color: "#FFD700", label: tL("lootLegendLabel"), desc: tL("lootLegendDesc") },
        { icon: "🔥", color: "#FFD700", label: tL("dealsLabel"),      desc: tL("dealsDesc") },
      ],
    },
  ], [tL]);
  return (
    <Modal open={true} onClose={onClose} size="md" zIndex={Z.modal}>
      <ModalHeader
        kicker={tL("kicker")}
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>🗺️ {tL("title")}</span>}
        onClose={onClose}
        accent="primary"
      />
      <ModalBody padding="padded">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#8B8FA3", fontWeight: 900, marginBottom: 8, paddingLeft: 4 }}>
                {sec.title.toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sec.entries.map((e, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "10px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${e.color}18`, border: `1px solid ${e.color}66`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
                    }}>{e.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: e.color, fontSize: 13, fontWeight: 900 }}>{e.label}</div>
                      <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2, lineHeight: 1.45 }}>{e.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}

"use client";

type Entry = { icon: string; label: string; desc: string; color: string };
type Section = { title: string; entries: Entry[] };

const SECTIONS: Section[] = [
  {
    title: "Dein Fortschritt",
    entries: [
      { icon: "🟡", color: "#FFD700", label: "Dein Territorium", desc: "Geschlossenes Polygon in deiner Runner-Farbe." },
      { icon: "🟦", color: "#22D1C3", label: "Crew-Territorium", desc: "Eroberung deiner Crew — zählt für den Crew-Rang." },
      { icon: "🔴", color: "#FF2D78", label: "Feind-Territorium", desc: "Gehört einer anderen Crew. Überlaufen = Steal-Bonus." },
      { icon: "⚪", color: "#FFD700", label: "Pending (gestrichelt)", desc: "Ring geschlossen, aber noch ohne Crew — tritt einer bei und du kassierst 500 XP rückwirkend." },
    ],
  },
  {
    title: "Welt-Features",
    entries: [
      { icon: "📍", color: "#FF6B4A", label: "Shop / Partner-Spot", desc: "Lokale Geschäfte mit Deals und Loot. QR-Scan für Rabatt + Siegel." },
      { icon: "⚔️", color: "#FFD700", label: "Kampfarena (Shop)", desc: "Zeitbegrenzter Arena-Spot: Runner treffen sich hier zum 1v1." },
      { icon: "🔦", color: "#FFD700", label: "Spotlight", desc: "Besonders beworbener Shop — extra Siegel-Chance beim Einlösen." },
      { icon: "🐉", color: "#FF2D78", label: "Boss-Raid", desc: "Gemeinsam mit Crew den Boss klopfen → Top-Loot." },
      { icon: "🏛️", color: "#22D1C3", label: "Sanktum", desc: "Täglicher Wächter-XP-Boost beim Vorbeilaufen." },
      { icon: "⚡", color: "#a855f7", label: "Power-Zone", desc: "Zone mit passivem Buff für deinen Wächter." },
      { icon: "💥", color: "#FF6B4A", label: "Flash-Push", desc: "Kurzzeitiger Crew-Challenge-Spot — Doppel-XP für erste 15 min." },
    ],
  },
  {
    title: "Loot & Deals",
    entries: [
      { icon: "📦", color: "#9ba8c7", label: "Common-Kiste", desc: "Kleiner Loot — Gewöhnlich" },
      { icon: "🎁", color: "#5ddaf0", label: "Rare-Geschenk", desc: "Selteneres Loot-Drop" },
      { icon: "💎", color: "#a855f7", label: "Epic-Diamant", desc: "Epischer Drop — 25m rangehen zum Einsammeln" },
      { icon: "👑", color: "#FFD700", label: "Legendary-Krone", desc: "Legendärer Drop — mega selten!" },
      { icon: "🔥", color: "#FFD700", label: "Tages-Deals", desc: "Floating Badge oben — klick für 3 Packs + Super-Bundle." },
    ],
  },
];

export function MapLegendModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(8, 10, 14, 0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto",
        background: "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)",
        borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        color: "#FFF",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky", top: 0, background: "rgba(26,29,35,0.95)", backdropFilter: "blur(8px)", zIndex: 1,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, #22D1C3, #FFD700)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🗺️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#8B8FA3", fontWeight: 900 }}>MAP-LEGENDE</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 1 }}>Was bedeuten die Icons?</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8B8FA3", fontSize: 16, fontWeight: 900, cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
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
      </div>
    </div>
  );
}

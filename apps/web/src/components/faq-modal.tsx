"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

type FaqSection = {
  id: string;
  icon: string;
  title: string;
  color: string;
  items: { q: string; a: React.ReactNode }[];
};

// Helpers für rich-text Tags in den Übersetzungen.
const richTags = {
  b: (chunks: React.ReactNode) => <b style={{ color: "#FFF" }}>{chunks}</b>,
  br: () => <br />,
} as const;

const SECTION_DEFS: { id: string; key: string; icon: string; color: string; itemCount: number }[] = [
  { id: "erste-schritte",  key: "ersteSchritte",   icon: "🚀", color: "#5ddaf0", itemCount: 6 },
  { id: "grundlagen",      key: "grundlagen",      icon: "🏃", color: "#22D1C3", itemCount: 4 },
  { id: "waehrungen",      key: "waehrungen",      icon: "💰", color: "#FFD700", itemCount: 6 },
  { id: "crew-territorien",key: "crewTerritorien", icon: "👥", color: "#FF2D78", itemCount: 3 },
  { id: "waechter",        key: "waechter",        icon: "🛡️", color: "#a855f7", itemCount: 3 },
  { id: "shop",            key: "shop",            icon: "💎", color: "#5ddaf0", itemCount: 3 },
  { id: "sonstiges",       key: "sonstiges",       icon: "❓", color: "#8B8FA3", itemCount: 3 },
];

export function FaqModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Faq");
  const [openSection, setOpenSection] = useState<string>("erste-schritte");
  const [openItem, setOpenItem] = useState<string | null>("erste-schritte:0");

  const sections = useMemo<FaqSection[]>(() => {
    return SECTION_DEFS.map((def) => ({
      id: def.id,
      icon: def.icon,
      color: def.color,
      title: t(`Sections.${def.key}.title`),
      items: Array.from({ length: def.itemCount }, (_, i) => ({
        q: t(`Sections.${def.key}.q${i + 1}`),
        a: t.rich(`Sections.${def.key}.a${i + 1}`, richTags),
      })),
    }));
  }, [t]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(8, 10, 14, 0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto",
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
            background: "linear-gradient(135deg, #22D1C3, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>❓</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#8B8FA3", fontWeight: 900 }}>{t("header")}</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 1 }}>{t("subtitle")}</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8B8FA3", fontSize: 16, fontWeight: 900, cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {sections.map((sec) => {
            const open = openSection === sec.id;
            return (
              <div key={sec.id} style={{ marginBottom: 8 }}>
                <button onClick={() => setOpenSection(open ? "" : sec.id)} style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  background: open ? `${sec.color}15` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${open ? sec.color + "66" : "rgba(255,255,255,0.08)"}`,
                  color: "#FFF", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{sec.icon}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 900, color: open ? sec.color : "#FFF" }}>{sec.title}</span>
                  <span style={{ color: sec.color, fontSize: 14, fontWeight: 900, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                </button>
                {open && (
                  <div style={{ marginTop: 6, padding: "0 4px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {sec.items.map((it, i) => {
                      const key = `${sec.id}:${i}`;
                      const itemOpen = openItem === key;
                      return (
                        <div key={key}>
                          <button onClick={() => setOpenItem(itemOpen ? null : key)} style={{
                            width: "100%", padding: "10px 12px", borderRadius: 10,
                            background: itemOpen ? "rgba(255,255,255,0.04)" : "transparent",
                            border: "none", cursor: "pointer", textAlign: "left",
                            color: itemOpen ? sec.color : "#D0D0D5", fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            <span style={{ color: sec.color, fontWeight: 900, fontSize: 11 }}>{itemOpen ? "−" : "+"}</span>
                            <span style={{ flex: 1 }}>{it.q}</span>
                          </button>
                          {itemOpen && (
                            <div style={{ padding: "4px 14px 12px 26px", color: "#a8b4cf", fontSize: 13, lineHeight: 1.6 }}>
                              {it.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

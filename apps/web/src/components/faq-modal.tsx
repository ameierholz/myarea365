"use client";

import { useState } from "react";

type FaqSection = {
  id: string;
  icon: string;
  title: string;
  color: string;
  items: { q: string; a: React.ReactNode }[];
};

const B = ({ children, color = "#FFF" }: { children: React.ReactNode; color?: string }) =>
  <b style={{ color }}>{children}</b>;

const SECTIONS: FaqSection[] = [
  {
    id: "grundlagen",
    icon: "🏃",
    title: "Grundlagen",
    color: "#22D1C3",
    items: [
      {
        q: "Wie spiele ich MyArea365?",
        a: <>Geh oder jogge durch deine Stadt. Jeder Straßenabschnitt den du abläufst wird auf der Karte markiert und gehört dir. Je mehr du läufst, desto mehr 🪙 <B color="#22D1C3">Wegemünzen</B> kassierst du und desto höher steigst du im Rang.</>,
      },
      {
        q: "Was ist der Unterschied zwischen Abschnitt, Straßenzug und Gebiet?",
        a: <>
          <B color="#22D1C3">Straßenabschnitt</B> = kleinstes Stück Straße zwischen zwei Kreuzungen (50 🪙 Wegemünzen).<br />
          <B color="#FFD700">Straßenzug</B> = eine komplette Straße, wenn du alle ihre Abschnitte hast (+250 🪙 Bonus).<br />
          <B color="#FF2D78">Gebiet</B> = das Innere eines geschlossenen Rings aus mehreren Straßenzügen (+500 🪙, nur mit Crew).
        </>,
      },
      {
        q: "Wie entsteht ein Gebiet?",
        a: <>Wenn sich mehrere Straßenzüge zu einem geschlossenen Polygon (Block, Viereck, Kreis) treffen, markiert MyArea365 das Innere automatisch als Gebiet. Alle Straßen rundherum müssen als komplette Straßenzüge dir oder deiner Crew gehören.</>,
      },
      {
        q: "Brauche ich eine Crew für Gebiete?",
        a: <>Ja. Solo-Runner sehen den geschlossenen Ring zwar grau gestrichelt auf der Karte (Anwartschaft), kassieren den 500-Wegemünzen-Bonus aber erst, sobald sie einer Crew beitreten oder eine gründen. Das macht Crews wertvoll.</>,
      },
    ],
  },
  {
    id: "waehrungen",
    icon: "💰",
    title: "Währungen & Ränge",
    color: "#FFD700",
    items: [
      {
        q: "Welche Währungen gibt es?",
        a: <>Drei getrennte Belohnungsströme, damit eine Arena-Niederlage nicht deine Runner-Progression zerstört:<br /><br />
          🪙 <B color="#22D1C3">Wegemünzen</B> — Laufen, Territory-Claim, Missionen, Shop-XP-Packs.<br />
          🏴 <B color="#FF2D78">Gebietsruf</B> — Crew-War-Sieg, Flaggen-Capture, Crew-Duell, Crew-Challenge.<br />
          ⚔️ <B color="#FFD700">Sessionehre</B> — Arena-Sieg (+) / Arena-Niederlage (−, Floor bei 0).
        </>,
      },
      {
        q: "Wofür gibt es 🪙 Wegemünzen?",
        a: <>
          • <B>Neuer Straßenabschnitt</B>: 50 🪙<br />
          • <B>Kompletter Straßenzug</B>: +250 🪙 Bonus<br />
          • <B>Geschlossenes Gebiet</B> (Crew): +500 🪙<br />
          • <B>Tages-/Wochen-Missionen</B>: 200–500 🪙<br />
          • <B>Meilensteine</B> (erste 10 km, 30 Tage Streak etc.): extra Bonus
        </>,
      },
      {
        q: "Wofür gibt es 🏴 Gebietsruf?",
        a: <>
          • <B>Crew-War gewonnen</B>: 5 000 🏴 an alle aktiven Mitglieder<br />
          • <B>Flaggen-Capture gewonnen</B>: 3 000 🏴<br />
          • <B>Wochen-Duell gewonnen</B>: 2 000 🏴<br />
          • <B>Crew-Challenge abgeschlossen</B>: variabler Reward<br /><br />
          Gebietsruf ist persönlich — du trägst ihn auch mit, wenn du die Crew wechselst, aber er wird nur im Crew-Kontext verdient.
        </>,
      },
      {
        q: "Wofür gibt es ⚔️ Sessionehre?",
        a: <>Arena-Kämpfe verteilen Ehre um: Sieger gewinnt ca. +50 %, Verlierer verliert ca. 20 % vom Battle-XP. Kann nicht negativ werden (Floor bei 0). Wird saisonweise betrachtet — prestige-relevant, aber beeinflusst <B>nicht</B> deine Wegemünzen oder den Rang.</>,
      },
      {
        q: "Gibt es Wegemünzen für alte Straßen, die ich nochmal laufe?",
        a: <>Ja — aber gedrosselt, damit niemand farmt. 24 h nach dem ersten Claim: 0 (Cooldown). 1–7 Tage: 30 % des normalen Werts. 7–30 Tage: 60 %. Nach 30 Tagen: voller Wert wieder. Wird dir im Lauf-Summary transparent angezeigt.</>,
      },
      {
        q: "Wie steige ich im Rang auf?",
        a: <>Rang richtet sich nach Gesamt-🪙 Wegemünzen. Vom <B>Straßen-Scout</B> (0) bis zum <B color="#FFD700">Straßen-Gott</B> (250.000) gibt es 10 Ränge mit eigenen Farben, Mottos und Rewards.</>,
      },
    ],
  },
  {
    id: "crew-territorien",
    icon: "👥",
    title: "Crew & Gebiete",
    color: "#FF2D78",
    items: [
      {
        q: "Wie gründe ich eine Crew?",
        a: <>Tab „Crew" → „Crew gründen". Du brauchst einen Namen, eine Farbe und eine PLZ als Revier. Crew-Mitglieder können dann gemeinsam Gebiete erobern und verteidigen.</>,
      },
      {
        q: "Kann ein Gebiet gestohlen werden?",
        a: <>Ja. Wenn eine feindliche Crew den Ring nachläuft und dabei mehr als 50 % der Segmente neu claimt, wechselt das Gebiet die Farbe. Die alte Crew bekommt eine Benachrichtigung — Revanche ist möglich. Steal-Bonus: 1.5× Wegemünzen für den Räuber.</>,
      },
      {
        q: "Was passiert wenn meine Crew inaktiv ist?",
        a: <>Gebiete verfallen nach 30 Tagen ohne Aktivität auf „unbeansprucht" und können von anderen Crews zurückerobert werden. Ein einzelner Crew-Lauf pro Woche reicht, um das Revier zu halten.</>,
      },
    ],
  },
  {
    id: "waechter",
    icon: "🛡️",
    title: "Wächter",
    color: "#a855f7",
    items: [
      {
        q: "Was sind Wächter?",
        a: <>Dein persönlicher Gefährte mit eigenem Level, Klasse (Infanterie/Kavallerie/Scharfschütze/Magier) und einzigartiger Fähigkeit. Je mehr du läufst, desto stärker wird er.</>,
      },
      {
        q: "Wie bekomme ich neue Wächter?",
        a: <>Über Beschwörungssteine (alle 10 km gelaufen +1 Stein), Arena-Siege, Shop, oder durch Loot im Gebiet. Sammle sie alle — es gibt 30+ Archetypen in 4 Raritäten.</>,
      },
      {
        q: "Kampfarena — wie funktioniert das?",
        a: <>1v1 Wächter-Kämpfe gegen andere Runner. 5 Gratis-Kämpfe pro Tag, weitere gegen Diamanten. Gewinn = Siegel + Ausrüstung + Wächter-XP + ⚔️ Sessionehre. Verlust = leichter Sessionehre-Abzug (Floor 0), nichts wird zerstört.</>,
      },
    ],
  },
  {
    id: "shop",
    icon: "💎",
    title: "Shop & Diamanten",
    color: "#5ddaf0",
    items: [
      {
        q: "Brauche ich zu bezahlen, um gut zu sein?",
        a: <>Nein. Alle Gameplay-relevanten Inhalte (Wächter, Gebiete, Ränge) sind komplett spielbar ohne Echtgeld. Der Shop bietet nur Komfort (Streak-Freezes), Kosmetik (Map-Icons, Runner-Lights) und Zeit-Boosts.</>,
      },
      {
        q: "Was sind die Tagesangebote?",
        a: <>Täglich 3 individuelle Deals (Bronze/Silber/Gold) + optional 1 Super-Bundle. Jedes Pack 1× pro Tag kaufbar. Reset um 00:00.</>,
      },
      {
        q: "Was bringt MyArea+?",
        a: <>Premium-Abo mit Streak-Freeze-Vorrat, Wegemünzen-Boost, Shop-Rabatt und exklusiven Map-Themes. Kündbar monatlich.</>,
      },
    ],
  },
  {
    id: "sonstiges",
    icon: "❓",
    title: "Sonstiges",
    color: "#8B8FA3",
    items: [
      {
        q: "Läuft MyArea365 im Hintergrund?",
        a: <>Ja, solange der Browser offen ist und GPS-Berechtigung gegeben wurde. Für Dauer-Tracking empfehlen wir die kommende Mobile-App.</>,
      },
      {
        q: "Was ist mit meinen Daten?",
        a: <>Wir speichern nur den Minimalsatz (Strecken, Währungsstände, Profil). Keine Weitergabe. Vollständige DSGVO-Info im Datenschutz-Link im Profil-Footer.</>,
      },
      {
        q: "Ich habe einen Bug / Vorschlag gefunden",
        a: <>Profil → Menü → 🎫 Support. Wir antworten meistens binnen 48 h.</>,
      },
    ],
  },
];

export function FaqModal({ onClose }: { onClose: () => void }) {
  const [openSection, setOpenSection] = useState<string>("grundlagen");
  const [openItem, setOpenItem] = useState<string | null>("grundlagen:0");

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
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#8B8FA3", fontWeight: 900 }}>HILFE & FAQ</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 1 }}>Wie spiele ich MyArea365?</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8B8FA3", fontSize: 16, fontWeight: 900, cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {SECTIONS.map((sec) => {
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

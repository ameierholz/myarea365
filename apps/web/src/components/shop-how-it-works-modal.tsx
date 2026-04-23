"use client";

/**
 * Info-Modal für Shop-Betreiber: erklärt auf einen Blick, was der Runner
 * macht und was das Personal machen muss. Ziel: "So wenig wie möglich tun".
 */
export function ShopHowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3900,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.4)",
        color: "#F0F0F0", boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>SHOP-BETREIBER</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>So funktioniert MyArea365 bei dir</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf", width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 22 }}>
          <Section title="Einmal einstellen — dann läuft's">
            <Step n={1} icon="🏷️" title="Deal anlegen"
              body="Ein Deal (z. B. Gratis Cappuccino ab 3 km Lauf) im Tab Deals anlegen. Kannst du jederzeit pausieren oder anpassen." />
            <Step n={2} icon="🔲" title="QR-Aufsteller auslegen"
              body="Drucke den QR-Code selbst aus oder bestell einen Acryl-Aufsteller (ab 12,90 €) — einmal an die Theke, fertig." />
            <Step n={3} icon="🎯" title="(Optional) Bonus-Artikel definieren"
              body="Im Tab Quests kannst du festlegen: Wer einen Latte Macchiato kauft, bekommt zusätzlich ein Siegel. Runner fotografieren dafür den Bon — KI prüft automatisch." />
          </Section>

          <Section title="Was passiert beim Einlösen — dein Aufwand: 5 Sekunden">
            <Step n={1} icon="📱" title="Runner scannt deinen QR am Aufsteller"
              body="Die App prüft per GPS, dass der Runner wirklich vor Ort ist. Keine Eingabe, kein Code, kein Dashboard-Öffnen deinerseits." />
            <Step n={2} icon="✓" title="Runner zeigt grünen Bestätigungs-Screen"
              body={<>Du siehst auf seinem Handy: <b style={{ color: "#4ade80" }}>großes grünes ✓</b> + <b>Shop-Name</b> + <b>Live-Uhrzeit</b> + rotierender Animations-Ring. <br /><i style={{ color: "#8B8FA3" }}>Screenshots haben einen stehenden Ring — sofort erkennbar.</i></>} />
            <Step n={3} icon="🛍️" title="(Falls gesetzt) Mindestumsatz prüfen"
              body="Wenn dein Deal einen Mindestumsatz hat (z. B. ab 5 €), steht der direkt groß auf seinem Screen. Kassenpersonal vergleicht mit der Register-Summe." />
            <Step n={4} icon="🧾" title="Rabatt geben — fertig"
              body="Keine Eingabe in unserer App. Du tippst nichts in dein Shop-Dashboard. Der Runner bekommt seine Belohnung automatisch; du siehst die Einlösung rückblickend in Performance." />
          </Section>

          <Section title="Automatische Zusatz-Features (läuft im Hintergrund)">
            <Feature icon="📸" title="Kassenbon-Bonus-Loot"
              body="Runner fotografiert freiwillig den Bon → unsere KI liest den Betrag → ab 15 € gibt's Legendary-Loot (Siegel + Ausrüstung). Runner haben einen Grund, mehr zu kaufen. Du musst nichts tun." />
            <Feature icon="🎯" title="Quest-Artikel-Match"
              body="Hast du eine Quest (z. B. Latte Macchiato erkennen)? KI scannt den Bon nach dem Wort → Runner bekommt Bonus. Einmal konfigurieren, nie mehr anfassen." />
            <Feature icon="🏆" title="Gebietsfürst-Bonus"
              body="Wer deinen Shop-Bereich regelmäßig erobert, bekommt automatisch +50 % Wegemünzen bei dir. Stammkunden-Mechanismus, eingebaut." />
            <Feature icon="📊" title="Performance-Dashboard"
              body="Im Tab Performance siehst du: Einlösungen heute/Woche/Monat, Top-Zeiten, Wiederkehr-Rate, Kassenbeitrag. Alles live." />
          </Section>

          <div style={{
            marginTop: 20, padding: 14, borderRadius: 12,
            background: "rgba(34,209,195,0.1)",
            border: "1px solid rgba(34,209,195,0.3)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#22D1C3", marginBottom: 4 }}>
              📋 Dein Wochen-Aufwand: ca. 0–5 Minuten
            </div>
            <div style={{ fontSize: 12, color: "#a8b4cf", lineHeight: 1.55 }}>
              Kurz in die Performance schauen, vielleicht einen Deal saisonal anpassen oder
              einen Flash-Push abschicken wenn's leer ist. Mehr nicht.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 10 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: 12,
      padding: 12, borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 999,
        background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
        color: "#0F1115", fontSize: 13, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#FFF", marginBottom: 2 }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: 12, color: "#a8b4cf", lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: "rgba(255,215,0,0.06)",
      border: "1px solid rgba(255,215,0,0.15)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#FFD700", marginBottom: 2 }}>{icon} {title}</div>
      <div style={{ fontSize: 11, color: "#a8b4cf", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

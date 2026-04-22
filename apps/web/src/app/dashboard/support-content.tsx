"use client";

import { useState } from "react";

type Category = "general" | "bug" | "billing" | "partner" | "abuse" | "other";
const CATS: { key: Category; label: string; emoji: string }[] = [
  { key: "general", label: "Allgemein", emoji: "💬" },
  { key: "bug", label: "Bug", emoji: "🐛" },
  { key: "billing", label: "Kauf", emoji: "💳" },
  { key: "partner", label: "Partner", emoji: "🤝" },
  { key: "abuse", label: "Missbrauch", emoji: "⚠️" },
  { key: "other", label: "Sonst", emoji: "📎" },
];

export function SupportContent({ prefillEmail, prefillName }: { prefillEmail: string; prefillName: string }) {
  const [email, setEmail] = useState(prefillEmail);
  const [name, setName] = useState(prefillName);
  const [category, setCategory] = useState<Category>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !subject || !body) { setError("Bitte E-Mail, Betreff und Nachricht ausfüllen."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, category, subject, body }),
      });
      const j = await res.json();
      if (!j.ok) { setError(j.error ?? "Fehler beim Senden."); return; }
      setDone(j.ticket_id);
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={{ padding: 18, borderRadius: 14, background: "rgba(34,209,195,0.1)", border: "1px solid rgba(34,209,195,0.4)" }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#FFF", marginBottom: 4 }}>Anfrage erhalten!</div>
        <div style={{ fontSize: 12, color: "#a8b4cf", marginBottom: 10 }}>
          Wir antworten per E-Mail an <b>{email}</b> — meist innerhalb von 24h.
        </div>
        <code style={{ display: "block", padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.3)", fontSize: 11, color: "#22D1C3", fontFamily: "monospace", marginBottom: 10 }}>
          {done}
        </code>
        <button
          onClick={() => { setDone(null); setSubject(""); setBody(""); }}
          style={{ background: "transparent", border: "none", color: "#22D1C3", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
        >
          Weitere Anfrage
        </button>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(15,17,21,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#FFF", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#8B8FA3", marginBottom: 4,
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={lbl}>NAME (OPT.)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" style={inp} />
        </div>
        <div>
          <label style={lbl}>E-MAIL *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="du@example.com" style={inp} />
        </div>
      </div>

      <div>
        <label style={lbl}>THEMA</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {CATS.map((c) => {
            const on = category === c.key;
            return (
              <button
                key={c.key} type="button" onClick={() => setCategory(c.key)}
                style={{
                  padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: on ? "rgba(34,209,195,0.15)" : "rgba(26,29,35,0.7)",
                  border: `1px solid ${on ? "rgba(34,209,195,0.6)" : "rgba(255,255,255,0.1)"}`,
                  color: on ? "#22D1C3" : "#a8b4cf",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={lbl}>BETREFF *</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={120} placeholder="Kurz auf den Punkt" style={inp} />
      </div>

      <div>
        <label style={lbl}>NACHRICHT *</label>
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} required rows={5} maxLength={4000}
          placeholder="Was ist los? Gerät, Browser, was du erwartet hast, was passiert ist…"
          style={{ ...inp, resize: "vertical" }}
        />
        <div style={{ fontSize: 10, color: "#6c7590", textAlign: "right", marginTop: 2 }}>{body.length}/4000</div>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.4)", color: "#FF2D78", fontSize: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit" disabled={busy}
        style={{
          padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 900, color: "#0F1115",
          border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.4 : 1,
          background: "linear-gradient(135deg, #22D1C3 0%, #FFD700 100%)",
        }}
      >
        {busy ? "Sende …" : "📤 Anfrage senden"}
      </button>

      <p style={{ fontSize: 10, color: "#6c7590", lineHeight: 1.5, margin: 0 }}>
        Mit dem Absenden stimmst du der Verarbeitung deiner Angaben zur Bearbeitung deiner Anfrage zu (Datenschutzerklärung). Speicherdauer: bis zu 3 Jahre.
      </p>
    </form>
  );
}

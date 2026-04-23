"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SHOP_CATEGORY_GROUPS } from "@/lib/shop-categories";

export default function ShopRegisterPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      name:          String(fd.get("name") ?? "").trim(),
      category:      String(fd.get("category") ?? "").trim(),
      street:        String(fd.get("street") ?? "").trim(),
      zip:           String(fd.get("zip") ?? "").trim(),
      city:          String(fd.get("city") ?? "").trim(),
      state:         String(fd.get("state") ?? "").trim(),
      country:       String(fd.get("country") ?? "DE").trim(),
      contact_email: String(fd.get("contact_email") ?? "").trim(),
      contact_phone: String(fd.get("contact_phone") ?? "").trim(),
      description:   String(fd.get("description") ?? "").trim(),
      website:       String(fd.get("website") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/shop/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) {
        if (j.error === "auth_required") {
          setError("Bitte zuerst einloggen. Du wirst in 2 Sekunden weitergeleitet.");
          setTimeout(() => router.push("/login?next=/shop/anmelden"), 2000);
          return;
        }
        setError(ERR_MSG[j.error as string] ?? j.error ?? "Unbekannter Fehler");
        return;
      }
      setDone(j.shop_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", padding: 40 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Danke! Shop eingereicht.</h1>
          <p style={{ color: "#a8b4cf", lineHeight: 1.6, marginBottom: 24 }}>
            Wir prüfen deine Einreichung innerhalb von 48 Stunden und schicken dir
            eine Bestätigung per E-Mail. Sobald dein Shop freigegeben ist, siehst
            du ihn auf der Karte und kannst das Shop-Dashboard nutzen.
          </p>
          <button
            onClick={() => router.push("/shop-dashboard")}
            style={BTN_PRIMARY}
          >Zum Shop-Dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", padding: "40px 20px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#22D1C3", fontWeight: 900, marginBottom: 8 }}>
          MYAREA365 · PARTNER-SHOPS
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>
          Mach dein Geschäft zum Running-Point
        </h1>
        <p style={{ color: "#a8b4cf", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
          Trag dein Café, deine Bäckerei oder dein Studio kostenlos ein. Runner scannen
          deinen QR-Code beim Vorbeilaufen und bekommen Bewegungs-Boni — du bekommst
          Laufkundschaft. Die ersten 30 Tage sind gratis.
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10, marginBottom: 32,
        }}>
          <BenefitCard icon="📍" text="Als POI auf der Laufkarte gepinnt" />
          <BenefitCard icon="🪙" text="Wegemünzen-Belohnung lockt Runner" />
          <BenefitCard icon="📊" text="Live-Dashboard mit Besuchen & Scans" />
          <BenefitCard icon="⚡" text="Optional: Flash-Push in 1 km Radius" />
        </div>

        <form onSubmit={handleSubmit} style={{
          background: "#1A1D23", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)", padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16 }}>Shop-Daten</h2>

          <Field name="name" label="Name des Geschäfts *" placeholder="Café Müller" required />
          <Field name="category" label="Kategorie *" asCategorySelect required />

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <Field name="street" label="Straße + Hausnummer *" placeholder="Kreuzbergstr. 12" required />
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
              <Field name="zip" label="PLZ *" placeholder="10965" required maxLength={5} />
              <Field name="city" label="Stadt *" placeholder="Berlin" required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <Field name="state" label="Bundesland / Kanton (optional)" placeholder="Berlin, Bayern, Wien …" />
              <Field name="country" label="Land *" asSelect required options={["DE","AT","CH"]} />
            </div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "20px 0 12px" }}>Kontakt</h2>
          <Field name="contact_email" label="E-Mail *" placeholder="info@cafe-mueller.de" required type="email" />
          <Field name="contact_phone" label="Telefon (optional)" placeholder="030 12345678" type="tel" />
          <Field name="website" label="Website (optional)" placeholder="https://cafe-mueller.de" type="url" />

          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "20px 0 12px" }}>Kurz-Beschreibung</h2>
          <Field name="description" label="Was macht deinen Shop besonders? (optional)" asTextarea
            placeholder="Third-Wave-Coffee mit eigener Röstung, Sauerteigbrot aus lokaler Produktion…" />

          {error && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 10,
              background: "rgba(255,45,120,0.12)", border: "1px solid #FF2D78",
              color: "#FF2D78", fontSize: 13, fontWeight: 700,
            }}>⚠️ {error}</div>
          )}

          <button type="submit" disabled={busy} style={{ ...BTN_PRIMARY, marginTop: 20, width: "100%", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Wird eingereicht…" : "Shop einreichen"}
          </button>

          <p style={{ fontSize: 11, color: "#8B8FA3", marginTop: 14, lineHeight: 1.5 }}>
            Nach dem Einreichen prüfen wir deine Angaben. Das dauert max. 48 h.
            Du erhältst eine Bestätigung per E-Mail an die angegebene Adresse.
          </p>
        </form>
      </div>
    </main>
  );
}

const ERR_MSG: Record<string, string> = {
  missing_name: "Bitte gib einen Shop-Namen an.",
  missing_category: "Bitte wähle eine Kategorie.",
  missing_street: "Bitte gib die Straße an.",
  missing_zip: "Bitte gib eine PLZ an.",
  missing_city: "Bitte gib die Stadt an.",
  missing_contact_email: "Bitte gib eine Kontakt-E-Mail an.",
  invalid_email: "E-Mail-Format ist ungültig.",
  invalid_zip: "PLZ muss 4–5 Ziffern haben.",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "12px 20px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
  color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 0.5,
  cursor: "pointer",
};

function BenefitCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: "rgba(34,209,195,0.08)",
      border: "1px solid rgba(34,209,195,0.25)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#D0D0D5", fontWeight: 700, lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}

function Field({ name, label, placeholder, required, type = "text", maxLength, asTextarea, asSelect, asCategorySelect, options }: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  asTextarea?: boolean;
  asSelect?: boolean;
  asCategorySelect?: boolean;
  options?: string[];
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
    color: "#F0F0F0", fontSize: 14, fontFamily: "inherit",
  };
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "#a8b4cf", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {asTextarea ? (
        <textarea name={name} placeholder={placeholder} rows={3} style={inputStyle} maxLength={500} />
      ) : asCategorySelect ? (
        <select name={name} required={required} defaultValue="" style={inputStyle}>
          <option value="" disabled>Bitte wählen…</option>
          {SHOP_CATEGORY_GROUPS.map((grp) => (
            <optgroup key={grp.label} label={grp.label}>
              {grp.items.map((it) => <option key={it} value={it}>{it}</option>)}
            </optgroup>
          ))}
        </select>
      ) : asSelect ? (
        <select name={name} required={required} defaultValue="" style={inputStyle}>
          <option value="" disabled>Bitte wählen…</option>
          {(options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input name={name} type={type} placeholder={placeholder} required={required} maxLength={maxLength} style={inputStyle} />
      )}
    </label>
  );
}

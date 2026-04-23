"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Shop = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  state: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  opening_hours: DayHours[] | null;
  paused_at: string | null;
  active: boolean;
};

type DayHours = { day: string; open: string; close: string; closed: boolean };

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Montag" },
  { key: "tue", label: "Dienstag" },
  { key: "wed", label: "Mittwoch" },
  { key: "thu", label: "Donnerstag" },
  { key: "fri", label: "Freitag" },
  { key: "sat", label: "Samstag" },
  { key: "sun", label: "Sonntag" },
];

import { SHOP_CATEGORY_GROUPS } from "@/lib/shop-categories";

const defaultHours: DayHours[] = DAYS.map((d) => ({
  day: d.key, open: "09:00", close: "18:00", closed: d.key === "sun",
}));

export function ShopSettingsPanel({ shopId, onBillingClick }: { shopId: string; onBillingClick: () => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/shop/my`, { cache: "no-store" });
      const j = await res.json() as { shops: Shop[] };
      // Match auf übergebene shopId — fallback: erster Owner-Shop
      const match = j.shops?.find((x) => x.id === shopId);
      setShop(match ?? j.shops?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(body: Record<string, unknown>, hint = "Gespeichert") {
    setSaving(true);
    const res = await fetch("/api/shop/profile", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, ...body }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.ok) {
      setSavedHint(hint);
      setTimeout(() => setSavedHint(null), 2000);
      void load();
    } else {
      setSavedHint("Fehler: " + (j.error ?? "unbekannt"));
    }
  }

  if (loading) {
    return <div style={{ padding: 20, color: "#a8b4cf" }}>Lade Einstellungen…</div>;
  }
  if (!shop) {
    return (
      <div style={{
        padding: 30, textAlign: "center",
        background: "rgba(41, 51, 73, 0.35)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", marginBottom: 6 }}>
          Du hast noch keinen Shop
        </div>
        <div style={{ fontSize: 13, color: "#a8b4cf", marginBottom: 16, lineHeight: 1.5 }}>
          Trag dein Geschäft kostenlos ein — in max. 48 h ist dein Shop live auf der Karte.
        </div>
        <Link href="/shop/anmelden" style={{
          display: "inline-block",
          padding: "10px 18px", borderRadius: 10,
          background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
          color: "#0F1115", fontSize: 13, fontWeight: 900, textDecoration: "none",
        }}>Shop jetzt eintragen →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {savedHint && (
        <div style={{
          position: "sticky", top: 10, zIndex: 10,
          alignSelf: "flex-end",
          padding: "6px 12px", borderRadius: 8,
          background: savedHint.startsWith("Fehler") ? "rgba(255,45,120,0.2)" : "rgba(74,222,128,0.2)",
          color: savedHint.startsWith("Fehler") ? "#FF2D78" : "#4ade80",
          fontSize: 12, fontWeight: 800,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>{savedHint.startsWith("Fehler") ? "⚠️" : "✓"} {savedHint}</div>
      )}

      <ProfileBlock shop={shop} onSave={patch} saving={saving} />
      <HoursBlock shop={shop} onSave={patch} />
      <GpsBlock shop={shop} onSave={patch} />
      <NotificationsBlock shopId={shopId} />
      <TeamBlock shopId={shopId} />
      <BillingShortcut onClick={onBillingClick} />
      <DangerZone shop={shop} onReload={load} onSave={patch} />
    </div>
  );
}

/* ═════════ Profil ═════════ */
function ProfileBlock({ shop, onSave, saving }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: shop.name ?? "",
    category: shop.category ?? "",
    description: shop.description ?? "",
    city: shop.city ?? "",
    zip: shop.zip ?? "",
    state: shop.state ?? "",
    country: shop.country ?? "DE",
    contact_email: shop.contact_email ?? "",
    contact_phone: shop.contact_phone ?? "",
    website: shop.website ?? "",
    logo_url: shop.logo_url ?? "",
    cover_url: shop.cover_url ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSave(form, "Profil gespeichert");
  }

  return (
    <Block title="🏪 Shop-Profil">
      <form onSubmit={handleSubmit} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Shop-Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={INP} required />
        </Field>
        <Field label="Kategorie">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={INP}>
            <option value="">Bitte wählen…</option>
            {SHOP_CATEGORY_GROUPS.map((grp) => (
              <optgroup key={grp.label} label={grp.label}>
                {grp.items.map((it) => <option key={it} value={it}>{it}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Kurz-Beschreibung (wird Runnern auf Shop-POI angezeigt)">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} maxLength={500} style={INP} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
          <Field label="PLZ">
            <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} style={INP} maxLength={5} />
          </Field>
          <Field label="Stadt">
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={INP} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
          <Field label="Bundesland / Kanton">
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={INP} />
          </Field>
          <Field label="Land">
            <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={INP}>
              <option value="DE">DE</option><option value="AT">AT</option><option value="CH">CH</option>
            </select>
          </Field>
        </div>

        <Field label="Kontakt E-Mail">
          <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} style={INP} />
        </Field>
        <Field label="Telefon">
          <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} style={INP} />
        </Field>
        <Field label="Website">
          <input type="url" placeholder="https://…" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={INP} />
        </Field>

        <ImageUpload
          label="Shop-Logo (quadratisch, min. 256px)"
          shopId={shop.id}
          kind="logo"
          currentUrl={form.logo_url}
          onUploaded={(url) => setForm({ ...form, logo_url: url })}
        />
        <ImageUpload
          label="Cover-Bild (1200×400 empfohlen, optional)"
          shopId={shop.id}
          kind="cover"
          currentUrl={form.cover_url}
          onUploaded={(url) => setForm({ ...form, cover_url: url })}
        />

        <button type="submit" disabled={saving} style={BTN_PRIMARY}>
          {saving ? "Speichert…" : "Profil speichern"}
        </button>
      </form>
    </Block>
  );
}

/* ═════════ Öffnungszeiten ═════════ */
function HoursBlock({ shop, onSave }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
}) {
  const [hours, setHours] = useState<DayHours[]>(
    Array.isArray(shop.opening_hours) && shop.opening_hours.length === 7
      ? shop.opening_hours
      : defaultHours
  );

  function update(idx: number, field: keyof DayHours, value: string | boolean) {
    setHours((h) => h.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  return (
    <Block title="🕐 Öffnungszeiten">
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {DAYS.map((d, i) => (
          <div key={d.key} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 90px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#FFF", fontWeight: 600 }}>{d.label}</div>
            <input type="time" value={hours[i].open} disabled={hours[i].closed}
              onChange={(e) => update(i, "open", e.target.value)} style={{ ...INP, padding: "7px 10px" }} />
            <input type="time" value={hours[i].close} disabled={hours[i].closed}
              onChange={(e) => update(i, "close", e.target.value)} style={{ ...INP, padding: "7px 10px" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a8b4cf", cursor: "pointer" }}>
              <input type="checkbox" checked={hours[i].closed}
                onChange={(e) => update(i, "closed", e.target.checked)} />
              geschlossen
            </label>
          </div>
        ))}
        <button
          onClick={() => onSave({ opening_hours: hours }, "Öffnungszeiten gespeichert")}
          style={{ ...BTN_PRIMARY, marginTop: 6 }}
        >Zeiten speichern</button>
      </div>
    </Block>
  );
}

/* ═════════ GPS-Koordinaten ═════════ */
function GpsBlock({ shop, onSave }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
}) {
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");

  function fromGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
      },
      () => alert("GPS nicht verfügbar. Bitte Koordinaten manuell eingeben."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function save() {
    const la = Number(lat), ln = Number(lng);
    if (!isFinite(la) || !isFinite(ln)) { alert("Ungültige Koordinaten."); return; }
    if (la < -90 || la > 90 || ln < -180 || ln > 180) { alert("Koordinaten außerhalb gültiger Bereiche."); return; }
    void onSave({ lat: la, lng: ln }, "GPS gespeichert");
  }

  return (
    <Block title="📍 GPS-Standort (wichtig!)">
      <div style={{ padding: 16 }}>
        <p style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
          Ohne exakte Koordinaten funktioniert die <b style={{ color: "#FFD700" }}>GPS-Auto-Verify</b> beim Einlösen nicht.
          Runner müssen dann einen 6-stelligen Code bei dir eintippen lassen.
          <br />
          <b>Tipp:</b> Ruf die Seite im Shop auf und klick „Aktuellen Standort übernehmen".
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="Breitengrad (lat)">
            <input type="number" step="any" placeholder="52.4865"
              value={lat} onChange={(e) => setLat(e.target.value)} style={INP} />
          </Field>
          <Field label="Längengrad (lng)">
            <input type="number" step="any" placeholder="13.4450"
              value={lng} onChange={(e) => setLng(e.target.value)} style={INP} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={fromGeolocation} style={BTN_SECONDARY}>
            📍 Aktuellen Standort übernehmen
          </button>
          <button onClick={save} style={BTN_PRIMARY}>Koordinaten speichern</button>
          <a href={`https://www.google.com/maps?q=${encodeURIComponent(shop.address ?? "")}`}
            target="_blank" rel="noopener noreferrer" style={{ ...BTN_SECONDARY, textDecoration: "none" }}>
            🗺️ In Google Maps öffnen
          </a>
        </div>
      </div>
    </Block>
  );
}

/* ═════════ Notifications ═════════ */
type Prefs = {
  email_on_checkin: boolean;
  email_daily_report: boolean;
  email_weekly_summary: boolean;
  kiez_newsletter: boolean;
};
function NotificationsBlock({ shopId }: { shopId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/notifications?shop_id=${shopId}`);
    const j = await res.json();
    setPrefs(j.prefs);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(k: keyof Prefs) {
    if (!prefs) return;
    const updated = { ...prefs, [k]: !prefs[k] };
    setPrefs(updated);
    await fetch("/api/shop/notifications", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, [k]: updated[k] }),
    });
  }

  if (!prefs) return <Block title="🔔 Benachrichtigungen"><div style={{ padding: 16, color: "#a8b4cf" }}>Lade…</div></Block>;

  return (
    <Block title="🔔 Benachrichtigungen">
      <div style={{ padding: 8 }}>
        <Toggle label="E-Mail bei jedem Check-in" value={prefs.email_on_checkin} onChange={() => toggle("email_on_checkin")} />
        <Toggle label="Täglicher Performance-Report per Mail" value={prefs.email_daily_report} onChange={() => toggle("email_daily_report")} />
        <Toggle label="Wöchentliches Summary per Mail" value={prefs.email_weekly_summary} onChange={() => toggle("email_weekly_summary")} />
        <Toggle label="Im monatlichen Kiez-Newsletter erscheinen" value={prefs.kiez_newsletter} onChange={() => toggle("kiez_newsletter")} />
      </div>
    </Block>
  );
}

/* ═════════ Team ═════════ */
type TeamMember = {
  id: string; email: string; role: string;
  invited_at: string; accepted_at: string | null; user_id: string | null;
};
function TeamBlock({ shopId }: { shopId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/team?shop_id=${shopId}`);
    const j = await res.json();
    setMembers(j.members ?? []);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    const res = await fetch("/api/shop/team", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, email, role }),
    });
    setBusy(false);
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    setEmail("");
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm("Team-Mitglied entfernen?")) return;
    await fetch(`/api/shop/team?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <Block title="👥 Team-Zugang">
      <div style={{ padding: 16 }}>
        <p style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
          Lade Mitarbeiter ein, damit sie Deals pflegen oder Einlösungen ansehen können.
          Wer noch keinen MyArea365-Account hat, wird bei Anmeldung automatisch verknüpft.
        </p>

        <form onSubmit={invite} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="email" required placeholder="mitarbeiter@shop.de"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ ...INP, flex: "1 1 180px" }} />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
            style={{ ...INP, width: 140 }}>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
          <button type="submit" disabled={busy} style={BTN_PRIMARY}>
            {busy ? "…" : "+ Einladen"}
          </button>
        </form>

        {error && <div style={{ fontSize: 12, color: "#FF2D78", marginBottom: 10 }}>⚠️ {error}</div>}

        {members.length === 0 ? (
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 8, color: "#8B8FA3", fontSize: 12, textAlign: "center" }}>
            Noch niemand eingeladen.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{m.email}</div>
                  <div style={{ fontSize: 10, color: "#8B8FA3" }}>
                    {m.role.toUpperCase()} ·{" "}
                    {m.accepted_at ? <span style={{ color: "#4ade80" }}>✓ aktiv</span> : <span style={{ color: "#FFD700" }}>⏳ eingeladen</span>}
                  </div>
                </div>
                <button onClick={() => remove(m.id)} style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,45,120,0.4)",
                  background: "transparent", color: "#FF2D78", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>Entfernen</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Block>
  );
}

/* ═════════ Billing-Shortcut ═════════ */
function BillingShortcut({ onClick }: { onClick: () => void }) {
  return (
    <Block title="💳 Abrechnung & Paket">
      <button onClick={onClick} style={{
        width: "100%", padding: 16, textAlign: "left", cursor: "pointer",
        background: "transparent", border: "none", color: "#FFF",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Paket ansehen · Rechnungen · Stripe-Portal</div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 2 }}>
            Aktuelles Paket, Add-ons, Rechnungshistorie und Self-Service-Kündigung.
          </div>
        </div>
        <span style={{ color: "#22D1C3", fontSize: 18 }}>›</span>
      </button>
    </Block>
  );
}

/* ═════════ Danger-Zone ═════════ */
function DangerZone({ shop, onReload, onSave }: {
  shop: Shop;
  onReload: () => Promise<void>;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
}) {
  const paused = !!shop.paused_at;
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function togglePause() {
    await onSave({ paused: !paused }, paused ? "Shop aktiviert" : "Shop pausiert");
  }

  async function deleteShop() {
    if (confirmText !== "LÖSCHEN") return;
    setDeleting(true);
    const res = await fetch("/api/shop/delete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shop.id, confirm: "LÖSCHEN" }),
    });
    setDeleting(false);
    const j = await res.json();
    if (j.ok) {
      window.location.href = "/dashboard";
    } else {
      alert("Fehler: " + (j.error ?? "unbekannt"));
    }
    await onReload();
  }

  return (
    <Block title="⚠️ Account" danger>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Link href="/einstellungen" style={{
          padding: 12, borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#FFF", textDecoration: "none", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>🔒 Passwort ändern / Account-Einstellungen</span>
          <span style={{ color: "#a8b4cf" }}>›</span>
        </Link>

        <div style={{
          padding: 12, borderRadius: 8,
          background: paused ? "rgba(255,215,0,0.08)" : "rgba(74,222,128,0.05)",
          border: `1px solid ${paused ? "#FFD700" : "rgba(74,222,128,0.3)"}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: paused ? "#FFD700" : "#4ade80", marginBottom: 4 }}>
            {paused ? "⏸️ Shop ist aktuell pausiert" : "✓ Shop ist live"}
          </div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 10 }}>
            Pausierte Shops sind für Runner unsichtbar. Deals werden nicht mehr angezeigt. Du kannst jederzeit reaktivieren.
          </div>
          <button onClick={togglePause} style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: paused ? "#4ade80" : "#FFD700", color: "#0F1115",
            fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}>
            {paused ? "▶ Shop reaktivieren" : "⏸ Shop pausieren"}
          </button>
        </div>

        <div style={{
          padding: 12, borderRadius: 8,
          background: "rgba(255,45,120,0.08)",
          border: "1px solid rgba(255,45,120,0.35)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF2D78", marginBottom: 4 }}>
            🗑️ Shop unwiderruflich löschen
          </div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 10 }}>
            Alle Deals, Einlösungen, Crew-Stempel und Team-Mitglieder werden mitgelöscht. Keine Wiederherstellung.
            Tippe <b style={{ color: "#FF2D78" }}>LÖSCHEN</b> in das Feld, um zu bestätigen.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN" style={{ ...INP, flex: 1 }} />
            <button onClick={deleteShop} disabled={confirmText !== "LÖSCHEN" || deleting} style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: confirmText === "LÖSCHEN" ? "#FF2D78" : "rgba(255,255,255,0.06)",
              color: confirmText === "LÖSCHEN" ? "#FFF" : "#6c7590",
              fontSize: 12, fontWeight: 900, cursor: confirmText === "LÖSCHEN" ? "pointer" : "not-allowed",
            }}>{deleting ? "Lösche…" : "Löschen"}</button>
          </div>
        </div>
      </div>
    </Block>
  );
}

/* ═════════ Building-Blocks ═════════ */
function Block({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        color: danger ? "#FF2D78" : "#a8b4cf",
        fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8,
      }}>{title.toUpperCase()}</div>
      <div style={{
        background: "rgba(41, 51, 73, 0.35)",
        borderRadius: 14, overflow: "hidden",
        border: `1px solid ${danger ? "rgba(255,45,120,0.2)" : "rgba(255,255,255,0.08)"}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

function ImageUpload({ label, shopId, kind, currentUrl, onUploaded }: {
  label: string;
  shopId: string;
  kind: "logo" | "cover";
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("shop_id", shopId);
    fd.append("kind", kind);
    try {
      const res = await fetch("/api/shop/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error === "file_too_large" ? "Datei zu groß (max. 5 MB)" :
                 j.error === "invalid_mime" ? "Nur JPG / PNG / WEBP / GIF erlaubt" :
                 j.error ?? "Upload fehlgeschlagen");
        return;
      }
      onUploaded(j.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerkfehler");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {currentUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentUrl} alt=""
            style={{
              width: kind === "cover" ? 120 : 64,
              height: 64, borderRadius: 10,
              objectFit: "cover",
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }} />
        ) : (
          <div style={{
            width: kind === "cover" ? 120 : 64, height: 64, borderRadius: 10, flexShrink: 0,
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8B8FA3", fontSize: 10,
          }}>kein Bild</div>
        )}
        <div style={{ flex: 1 }}>
          <label style={{ ...BTN_SECONDARY, display: "inline-block", cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? "⏳ Lade hoch…" : currentUrl ? "🔁 Ersetzen" : "📤 Hochladen"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              style={{ display: "none" }} />
          </label>
          {currentUrl && (
            <button type="button" onClick={() => onUploaded("")} style={{
              marginLeft: 8, padding: "8px 12px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(255,45,120,0.3)",
              color: "#FF2D78", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>Entfernen</button>
          )}
          {error && <div style={{ fontSize: 11, color: "#FF2D78", marginTop: 6 }}>⚠️ {error}</div>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ color: "#FFF", fontSize: 13 }}>{label}</span>
      <button onClick={onChange} style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? "#22D1C3" : "rgba(255,255,255,0.1)",
        border: "none", cursor: "pointer", position: "relative", transition: "all 0.2s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: 10, background: "#FFF",
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

const INP: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
  color: "#F0F0F0", fontSize: 13, fontFamily: "inherit",
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
  color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer",
};
const BTN_SECONDARY: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#F0F0F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

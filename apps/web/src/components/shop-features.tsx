"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { appAlert, appConfirm } from "@/components/app-dialog";

type Shop = {
  id: string;
  name: string;
  plan?: string | null;
  spotlight_until?: string | null;
  radius_boost_until?: string | null;
  top_listing_until?: string | null;
  banner_until?: string | null;
  social_pro_until?: string | null;
  analytics_pro_until?: string | null;
  competitor_analysis_until?: string | null;
  custom_pin_url?: string | null;
  flash_push_credits?: number | null;
  event_host_credits?: number | null;
  challenge_sponsor_credits?: number | null;
  email_campaign_credits?: number | null;
};

function isActive(until: string | null | undefined) {
  return !!(until && new Date(until).getTime() > Date.now());
}

/* ═══════════════════════════════════════════════════════
 * FLASH-PUSH SENDER
 * ═══════════════════════════════════════════════════════ */
export function FlashPushPanel({ shop, onUsed }: { shop: Shop; onUsed: () => void }) {
  const sb = createClient();
  const credits = shop.flash_push_credits ?? 0;
  const [title, setTitle] = useState("Heute nur für Runner!");
  const [body, setBody] = useState("30 % auf alle Getränke bei Vorzeigen der App");
  const [radius, setRadius] = useState(1000);
  const [duration, setDuration] = useState(30);
  const [sending, setSending] = useState(false);

  async function send() {
    if (credits < 1) { appAlert("Keine Flash-Push-Credits mehr. Bitte im Shop-Power-Up nachkaufen."); return; }
    setSending(true);
    try {
      await sb.from("shop_push_messages").insert({
        business_id: shop.id,
        title, body, deal_text: body,
        radius_m: radius,
        expires_at: new Date(Date.now() + duration * 60_000).toISOString(),
      });
      await sb.from("local_businesses").update({ flash_push_credits: credits - 1 }).eq("id", shop.id);
      appAlert(`Flash-Push aktiv! Runner im ${(radius / 1000).toFixed(1)} km-Radius sehen deine Nachricht für ${duration} Minuten.`);
      onUsed();
    } finally { setSending(false); }
  }

  return (
    <Card title="⚡ Flash-Deal-Push" badge={`${credits} Credits`}>
      <Field label="Titel" value={title} onChange={setTitle} />
      <Field label="Nachricht" value={body} onChange={setBody} textarea />
      <div style={{ display: "flex", gap: 10 }}>
        <Field label={`Radius: ${(radius/1000).toFixed(1)} km`} value={String(radius)} onChange={(v) => setRadius(parseInt(v) || 500)} type="range" min={500} max={5000} step={500} />
        <Field label={`Dauer: ${duration} min`} value={String(duration)} onChange={(v) => setDuration(parseInt(v) || 15)} type="range" min={15} max={120} step={15} />
      </div>
      <PrimaryButton onClick={send} disabled={sending || credits < 1}>
        {sending ? "Sende…" : `Jetzt pushen (1 Credit verbraucht)`}
      </PrimaryButton>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * EVENT-HOST
 * ═══════════════════════════════════════════════════════ */
export function EventsPanel({ shop, onUsed }: { shop: Shop; onUsed: () => void }) {
  const sb = createClient();
  const credits = shop.event_host_credits ?? 0;
  const [events, setEvents] = useState<Array<{ id: string; title: string; starts_at: string; status: string }>>([]);
  const [title, setTitle] = useState("Sonntags-Lauf @ Café");
  const [desc, setDesc] = useState("Gemeinsamer 5 km Lauf, danach Kaffee bei uns.");
  const [date, setDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sb.from("shop_events").select("id, title, starts_at, status").eq("business_id", shop.id).order("starts_at", { ascending: false }).limit(10)
      .then(({ data }) => setEvents(data ?? []));
  }, [shop.id, sb]);

  async function create() {
    if (credits < 1) { appAlert("Keine Event-Host-Credits. Bitte nachkaufen."); return; }
    setSaving(true);
    try {
      await sb.from("shop_events").insert({
        business_id: shop.id, title, description: desc,
        starts_at: new Date(date).toISOString(),
        max_participants: 50,
      });
      await sb.from("local_businesses").update({ event_host_credits: credits - 1 }).eq("id", shop.id);
      appAlert("Event veröffentlicht! Runner im Kiez sehen es auf der Karte.");
      onUsed();
    } finally { setSaving(false); }
  }

  return (
    <Card title="🎪 Event-Host" badge={`${credits} Slots`}>
      <Field label="Titel" value={title} onChange={setTitle} />
      <Field label="Beschreibung" value={desc} onChange={setDesc} textarea />
      <Field label="Startzeit" value={date} onChange={setDate} type="datetime-local" />
      <PrimaryButton onClick={create} disabled={saving || credits < 1}>
        {saving ? "Speichere…" : "Event veröffentlichen"}
      </PrimaryButton>

      {events.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>DEINE EVENTS</div>
          {events.map((e) => (
            <div key={e.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#d6ddeb", display: "flex", justifyContent: "space-between" }}>
              <span>{e.title}</span>
              <span style={{ color: "#a8b4cf" }}>{new Date(e.starts_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * CHALLENGE-SPONSOR
 * ═══════════════════════════════════════════════════════ */
export function ChallengesPanel({ shop, onUsed }: { shop: Shop; onUsed: () => void }) {
  const sb = createClient();
  const credits = shop.challenge_sponsor_credits ?? 0;
  const [target, setTarget] = useState<"first_5k"|"ten_territories"|"weekly_km"|"streak_7d">("first_5k");
  const [reward, setReward] = useState("Gratis Cappuccino");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (credits < 1) { appAlert("Keine Sponsor-Credits mehr."); return; }
    setSaving(true);
    try {
      const title = target === "first_5k" ? "Erster 5-km-Lauf im Kiez"
        : target === "ten_territories" ? "10 Territorien in einer Woche"
        : target === "weekly_km" ? "50 km diese Woche"
        : "7-Tage-Streak";
      await sb.from("shop_challenges").insert({
        business_id: shop.id, title, target_type: target, reward_text: reward,
        ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
      await sb.from("local_businesses").update({ challenge_sponsor_credits: credits - 1 }).eq("id", shop.id);
      appAlert("Challenge gesponsert!");
      onUsed();
    } finally { setSaving(false); }
  }

  return (
    <Card title="🏆 Challenge-Sponsor" badge={`${credits} verfügbar`}>
      <Select label="Challenge-Typ" value={target} onChange={(v) => setTarget(v as typeof target)} options={[
        ["first_5k", "Erster 5 km"],
        ["ten_territories", "10 Territorien/Woche"],
        ["weekly_km", "50 km/Woche"],
        ["streak_7d", "7-Tage-Streak"],
      ]} />
      <Field label="Belohnung (an Gewinner)" value={reward} onChange={setReward} />
      <PrimaryButton onClick={create} disabled={saving || credits < 1}>
        {saving ? "Speichere…" : "Jetzt sponsern"}
      </PrimaryButton>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * SOCIAL-PRO GENERATOR
 * ═══════════════════════════════════════════════════════ */
export function SocialPanel({ shop }: { shop: Shop }) {
  const active = isActive(shop.social_pro_until);
  if (!active) return <LockedCard title="📱 Social-Post-Generator" msg="Aktiv mit Social-Pro-Abo (9,90 €/Mo)" />;

  const templates = [
    { id: "tpl1", label: "Stammkunden-Wochenpost",       color: "#FF2D78", gradient: "linear-gradient(135deg,#FF2D78,#a855f7)" },
    { id: "tpl2", label: "Neue Deal-Ankündigung",        color: "#FFD700", gradient: "linear-gradient(135deg,#FFD700,#FF6B4A)" },
    { id: "tpl3", label: "Kiez-Tipp-Story",              color: "#22D1C3", gradient: "linear-gradient(135deg,#22D1C3,#5ddaf0)" },
    { id: "tpl4", label: "Spotlight-Announcement",       color: "#a855f7", gradient: "linear-gradient(135deg,#a855f7,#FF2D78)" },
    { id: "tpl5", label: "Event-Einladung",              color: "#4ade80", gradient: "linear-gradient(135deg,#4ade80,#22D1C3)" },
    { id: "tpl6", label: "Challenge-Launch",             color: "#FF6B4A", gradient: "linear-gradient(135deg,#FF6B4A,#FFD700)" },
  ];

  function downloadTemplate(tplId: string, label: string) {
    const svg = buildSocialPostSvg(shop.name, label);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shop.name.toLowerCase().replace(/\s+/g, "-")}-${tplId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card title="📱 Social-Post-Generator" badge="PRO AKTIV">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
        {templates.map((t) => (
          <button key={t.id}
            onClick={() => downloadTemplate(t.id, t.label)}
            style={{
              aspectRatio: "9 / 16", borderRadius: 14,
              background: t.gradient, border: "none", cursor: "pointer",
              color: "#0F1115", fontWeight: 900, fontSize: 13,
              padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
            <span style={{ fontSize: 26 }}>📥</span>
            <span style={{ textAlign: "left" }}>{t.label}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>1080 × 1920 · SVG</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function buildSocialPostSvg(shopName: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#22D1C3"/>
        <stop offset="50%" stop-color="#a855f7"/>
        <stop offset="100%" stop-color="#FF2D78"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#g)"/>
    <text x="540" y="400" fill="white" font-size="56" font-weight="900" text-anchor="middle" font-family="system-ui">${shopName}</text>
    <text x="540" y="1000" fill="white" font-size="92" font-weight="900" text-anchor="middle" font-family="system-ui">${label}</text>
    <text x="540" y="1800" fill="white" font-size="32" font-weight="700" text-anchor="middle" font-family="system-ui" opacity="0.85">powered by MyArea365</text>
  </svg>`;
}

/* ═══════════════════════════════════════════════════════
 * E-MAIL-KAMPAGNE
 * ═══════════════════════════════════════════════════════ */
export function EmailPanel({ shop, onUsed }: { shop: Shop; onUsed: () => void }) {
  const sb = createClient();
  const credits = shop.email_campaign_credits ?? 0;
  const [subject, setSubject] = useState("Neuer Deal in deinem Kiez");
  const [body, setBody] = useState("Hallo Runner! Wir haben diese Woche eine neue Aktion für dich.");
  const [saving, setSaving] = useState(false);

  async function send() {
    if (credits < 1) { appAlert("Keine E-Mail-Kampagnen-Credits."); return; }
    if (!(await appConfirm({ title: "Kampagne senden?", message: `Diese Nachricht geht an alle Stammkunden im Kiez. Ein Credit wird verbraucht.`, confirmLabel: "Senden" }))) return;
    setSaving(true);
    try {
      await sb.from("shop_marketing_assets").insert({
        business_id: shop.id, kind: "email_campaign",
        title: subject, payload: { subject, body },
      });
      await sb.from("email_campaigns").insert({
        subject, template: "shop_deal", segment: "all_users",
        status: "scheduled", scheduled_at: new Date(Date.now() + 60_000).toISOString(),
      });
      await sb.from("local_businesses").update({ email_campaign_credits: credits - 1 }).eq("id", shop.id);
      appAlert("E-Mail-Kampagne eingeplant! Versand startet in wenigen Minuten.");
      onUsed();
    } finally { setSaving(false); }
  }

  return (
    <Card title="✉️ E-Mail-Kampagne" badge={`${credits} Credits`}>
      <Field label="Betreff" value={subject} onChange={setSubject} />
      <Field label="Inhalt" value={body} onChange={setBody} textarea />
      <PrimaryButton onClick={send} disabled={saving || credits < 1}>
        {saving ? "Sendet…" : "Jetzt senden"}
      </PrimaryButton>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * ANALYTICS-PRO VIEW
 * ═══════════════════════════════════════════════════════ */
export function AnalyticsProPanel({ shop }: { shop: Shop }) {
  const active = isActive(shop.analytics_pro_until);
  if (!active) return <LockedCard title="📊 Analytics Pro" msg="Aktiv mit Analytics-Pro-Abo (39 €/Mo)" />;

  const ageGroups = [
    { label: "18–24", pct: 18 }, { label: "25–34", pct: 34 }, { label: "35–44", pct: 26 },
    { label: "45–54", pct: 14 }, { label: "55+",   pct: 8 },
  ];
  const peakHours = [
    { h: "6-9",   visits: 12 }, { h: "9-12",  visits: 24 }, { h: "12-15", visits: 18 },
    { h: "15-18", visits: 36 }, { h: "18-21", visits: 42 }, { h: "21-24", visits: 9 },
  ];
  const maxVisits = Math.max(...peakHours.map((p) => p.visits));

  return (
    <Card title="📊 Analytics Pro" badge="PRO AKTIV">
      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>ALTERSVERTEILUNG STAMMKUNDEN</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        {ageGroups.map((g) => (
          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 52, color: "#a8b4cf", fontSize: 11 }}>{g.label}</span>
            <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${g.pct}%`, height: "100%", background: "linear-gradient(90deg,#22D1C3,#5ddaf0)" }} />
            </div>
            <span style={{ width: 30, textAlign: "right", color: "#FFF", fontSize: 11, fontWeight: 700 }}>{g.pct}%</span>
          </div>
        ))}
      </div>

      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>BESUCHS-HEATMAP (TAGESZEIT)</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${peakHours.length}, 1fr)`, gap: 4, marginBottom: 14 }}>
        {peakHours.map((p) => (
          <div key={p.h} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%", height: 60, borderRadius: 6,
              background: `rgba(255, 215, 0, ${p.visits / maxVisits})`,
              display: "flex", alignItems: "flex-end", justifyContent: "center", color: "#0F1115", fontWeight: 900, fontSize: 11,
            }}>{p.visits}</div>
            <span style={{ fontSize: 9, color: "#a8b4cf" }}>{p.h}</span>
          </div>
        ))}
      </div>

      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>LAUFROUTEN-HEATMAP (DEMO)</div>
      <div style={{
        height: 140, borderRadius: 12,
        background: "radial-gradient(circle at 30% 40%, rgba(255,215,0,0.6), transparent 30%), radial-gradient(circle at 70% 60%, rgba(255,45,120,0.5), transparent 30%), radial-gradient(circle at 50% 50%, rgba(34,209,195,0.5), transparent 25%), #0F1115",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 8,
      }}>
        <span style={{ color: "#a8b4cf", fontSize: 10 }}>Kiez 13435 · letzte 30 Tage</span>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * KONKURRENZ-ANALYSE
 * ═══════════════════════════════════════════════════════ */
export function CompetitorPanel({ shop }: { shop: Shop }) {
  const active = isActive(shop.competitor_analysis_until);
  if (!active) return <LockedCard title="🔍 Konkurrenz-Analyse" msg="Aktiv mit Konkurrenz-Abo (19 €/Mo)" />;

  const competitors = [
    { name: "Bäckerei Schmidt",    checkins: 142, redemptions: 38, spotlight: false, plan: "Basis" },
    { name: "Kaffee-Klüngel",      checkins: 184, redemptions: 52, spotlight: true,  plan: "Pro" },
    { name: "Espresso-Eck",        checkins: 96,  redemptions: 22, spotlight: false, plan: "Free" },
  ];
  const myCheckins = 184;

  return (
    <Card title="🔍 Konkurrenz-Analyse · 13435" badge="PRO">
      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>DEINE POSITION</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <CompRow name={shop.name} checkins={myCheckins} redemptions={49} plan="Pro" spotlight={isActive(shop.spotlight_until)} highlight />
        {competitors.map((c) => <CompRow key={c.name} {...c} />)}
      </div>
    </Card>
  );
}

function CompRow({ name, checkins, redemptions, plan, spotlight, highlight }: {
  name: string; checkins: number; redemptions: number; plan: string; spotlight: boolean; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      background: highlight ? "rgba(34,209,195,0.12)" : "rgba(255,255,255,0.04)",
      border: highlight ? "1px solid rgba(34,209,195,0.5)" : "1px solid rgba(255,255,255,0.08)",
      display: "flex", alignItems: "center", gap: 10, fontSize: 12,
    }}>
      <span style={{ flex: 1, color: "#FFF", fontWeight: highlight ? 900 : 700 }}>{name}{highlight && " (Du)"}</span>
      <span style={{ color: "#a8b4cf" }}>{checkins} CI</span>
      <span style={{ color: "#a8b4cf" }}>{redemptions} RE</span>
      <span style={{ color: "#FFD700", fontWeight: 700 }}>{plan}</span>
      {spotlight && <span style={{ color: "#FF2D78" }}>⭐</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * KIEZ-REPORT
 * ═══════════════════════════════════════════════════════ */
export function KiezReportPanel({ shop }: { shop: Shop }) {
  function generate() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kiez-Report ${shop.name}</title>
<style>
body{font-family:system-ui;background:#fafafa;color:#111;padding:40px;max-width:800px;margin:0 auto}
h1{color:#22D1C3}h2{color:#FF2D78;margin-top:32px;border-bottom:2px solid #FF2D78;padding-bottom:4px}
.kpi{display:inline-block;padding:16px 24px;background:#111;color:#FFD700;border-radius:12px;margin:4px;min-width:140px;text-align:center}
.kpi b{display:block;font-size:28px}.kpi span{font-size:11px;color:#a8b4cf}
</style></head><body>
<h1>📍 Kiez-Report · 13435 Berlin</h1>
<p><b>Auftraggeber:</b> ${shop.name} · Erstellt: ${new Date().toLocaleString("de-DE")}</p>
<h2>Wer läuft hier?</h2>
<div class="kpi"><b>247</b><span>Aktive Runner (30 T)</span></div>
<div class="kpi"><b>62 %</b><span>25–44 Jahre</span></div>
<div class="kpi"><b>41 %</b><span>Wiederkehrer</span></div>
<div class="kpi"><b>18:00</b><span>Peak-Laufzeit</span></div>
<h2>Beliebteste Straßen</h2>
<ol><li>Senftenberger Ring (412 Läufe)</li><li>Wartiner Str. (289)</li><li>Pasewalker Str. (246)</li></ol>
<h2>Geschäfte im Kiez</h2>
<p>14 Shops · 3 im Plus-Plan · 1 mit aktivem Spotlight</p>
<h2>Empfehlungen für ${shop.name}</h2>
<ul><li>Flash-Push zwischen 17:30 und 18:30 → höchste Runner-Dichte</li>
<li>Zielgruppe 25–34 ist überrepräsentiert → Social-Post-Anpassung</li>
<li>Konkurrenz "Kaffee-Klüngel" hat Spotlight aktiv → Top-Listing 7 T kaufen</li></ul>
<p style="margin-top:40px;color:#888;font-size:11px">Daten anonymisiert · powered by MyArea365</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <Card title="📄 Kiez-Report">
      <div style={{ color: "#d6ddeb", fontSize: 12, marginBottom: 10 }}>
        Anonymisierter Report mit Demografie, Peak-Zeiten, beliebte Straßen und konkreten Handlungsempfehlungen für deinen Shop.
      </div>
      <PrimaryButton onClick={generate}>📥 Report jetzt öffnen</PrimaryButton>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * CUSTOM-PIN
 * ═══════════════════════════════════════════════════════ */
export function CustomPinPanel({ shop, onUsed }: { shop: Shop; onUsed: () => void }) {
  const sb = createClient();
  const [url, setUrl] = useState(shop.custom_pin_url && shop.custom_pin_url !== "pending" ? shop.custom_pin_url : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await sb.from("local_businesses").update({ custom_pin_url: url || null }).eq("id", shop.id);
      appAlert("Custom-Pin aktiv! Neu laden um Änderung auf der Karte zu sehen.");
      onUsed();
    } finally { setSaving(false); }
  }

  return (
    <Card title="🎨 Custom-Pin-Design">
      <Field label="Bild-URL (PNG/SVG, quadratisch, min 64×64)" value={url} onChange={setUrl} placeholder="https://..." />
      {url && <div style={{ marginTop: 8 }}><img src={url} alt="Preview" style={{ width: 48, height: 48, borderRadius: 12, border: "2px solid #FFF" }} /></div>}
      <PrimaryButton onClick={save} disabled={saving}>{saving ? "Speichert…" : "Pin setzen"}</PrimaryButton>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
 * QR-DRUCK
 * ═══════════════════════════════════════════════════════ */
export function QrOrderPanel({ shop }: { shop: Shop }) {
  const ordered = !!(shop as { qr_print_ordered_at?: string | null }).qr_print_ordered_at;
  const code = shop.id.slice(0, 8).toUpperCase();
  return (
    <Card title="🖨️ QR-Code & Druckservice">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <QrPlaceholder code={code} businessId={shop.id} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Dein Check-in-QR</div>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>Code: <b>{code}</b></div>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>Ziel: myarea365.de/c/{code}</div>
        </div>
      </div>
      {ordered ? (
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(34,209,195,0.12)", color: "#22D1C3", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          ✓ Druck-Sticker bestellt — Lieferung 3–5 Werktage
        </div>
      ) : (
        <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 8 }}>
          Tipp: Kaufe den QR-Druckservice im Shop-Power-Up um einen bereits aufgebrachten Tür-Sticker per Post zu erhalten.
        </div>
      )}
      <a
        href={`/shop/${shop.id}/qr`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: "block", textAlign: "center",
          padding: "10px 14px", borderRadius: 10,
          background: "#FFD700", color: "#0F1115",
          border: "none", textDecoration: "none",
          fontSize: 13, fontWeight: 900,
        }}
      >
        🖨️ QR zum Selbstdrucken öffnen
      </a>
    </Card>
  );
}

function QrPlaceholder({ code, businessId }: { code: string; businessId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const payload = businessId ? `myarea:redeem:${businessId}` : `myarea:redeem:${code}`;
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, { width: 84, margin: 1, color: { dark: "#000", light: "#FFF" } }).catch(() => {});
  }, [payload]);
  return <canvas ref={canvasRef} width={84} height={84} style={{ borderRadius: 6, background: "#FFF" }} />;
}

/* ═══════════════════════════════════════════════════════
 * SHARED UI
 * ═══════════════════════════════════════════════════════ */
function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(41, 51, 73, 0.55)", borderRadius: 14, padding: 14,
      border: "1px solid rgba(255,255,255,0.14)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{title}</span>
        {badge && <span style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 1, padding: "2px 8px", borderRadius: 999, background: "rgba(34,209,195,0.15)", border: "1px solid rgba(34,209,195,0.4)" }}>{badge}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function LockedCard({ title, msg }: { title: string; msg: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 18,
      border: "1px dashed rgba(255,255,255,0.25)",
      textAlign: "center", color: "#a8b4cf", fontSize: 13,
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>🔒</div>
      <div style={{ color: "#FFF", fontWeight: 900, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11 }}>{msg}</div>
    </div>
  );
}

function Field({ label, value, onChange, textarea, type = "text", ...rest }: {
  label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; type?: string; placeholder?: string;
  min?: number; max?: number; step?: number;
}) {
  const style = {
    width: "100%", padding: 10, borderRadius: 8,
    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#FFF", fontSize: 13, fontFamily: "inherit",
  };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <span style={{ color: "#a8b4cf", fontSize: 11, fontWeight: 700 }}>{label}</span>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={style} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={style} {...rest} />
      }
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "#a8b4cf", fontSize: 11, fontWeight: 700 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: 13,
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 16px", borderRadius: 10,
      background: disabled ? "rgba(255,215,0,0.3)" : "#FFD700", color: "#0F1115",
      border: "none", cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 13, fontWeight: 900,
    }}>{children}</button>
  );
}

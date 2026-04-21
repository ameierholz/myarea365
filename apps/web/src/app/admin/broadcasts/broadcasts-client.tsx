"use client";

import { useCallback, useEffect, useState } from "react";

type Broadcast = {
  id: string; title: string; body: string; channel: string;
  segment: Record<string, unknown>; recipient_count: number | null;
  status: string; sent_at: string | null; sent_by_email: string | null; created_at: string;
};

const DEMO_BROADCASTS: Broadcast[] = [
  { id: "d1", title: "⚔️ Arena-Saison 2 startet!", body: "Wähle deinen Saison-Wächter und kämpfe in der Arena um Ehre und Prestige. Jetzt live!", channel: "push", segment: { min_level: 5 }, recipient_count: 1847, status: "sent", sent_at: new Date(Date.now() - 3 * 86400_000).toISOString(), sent_by_email: "admin@myarea365.de", created_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: "d2", title: "🔥 7-Tage-Streak-Bonus", body: "Diese Woche: doppelte XP für alle Runner mit 7-Tage-Streak!", channel: "inapp", segment: {}, recipient_count: 4231, status: "sent", sent_at: new Date(Date.now() - 7 * 86400_000).toISOString(), sent_by_email: "marketing@myarea365.de", created_at: new Date(Date.now() - 7 * 86400_000).toISOString() },
  { id: "d3", title: "Wir vermissen dich 👋", body: "Du warst länger nicht mehr da — dein Gebiet wird von anderen beansprucht. Schau vorbei!", channel: "email", segment: { inactive_days: 14 }, recipient_count: 623, status: "sent", sent_at: new Date(Date.now() - 2 * 86400_000).toISOString(), sent_by_email: "marketing@myarea365.de", created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { id: "d4", title: "☀️ Sonnenwacht-Wochenende", body: "Nur Sonnenwacht: 50% mehr XP am Samstag und Sonntag. Zeigt was ihr könnt!", channel: "push", segment: { faction: "vanguard" }, recipient_count: 892, status: "sent", sent_at: new Date(Date.now() - 10 * 86400_000).toISOString(), sent_by_email: "admin@myarea365.de", created_at: new Date(Date.now() - 10 * 86400_000).toISOString() },
  { id: "d5", title: "Neue Partner in Berlin-Mitte", body: "3 neue Cafés und 1 Bäckerei in Mitte — scanne den QR-Code für bis zu 20% Rabatt.", channel: "inapp", segment: { city: "Berlin" }, recipient_count: 1456, status: "sent", sent_at: new Date(Date.now() - 4 * 86400_000).toISOString(), sent_by_email: "sales@myarea365.de", created_at: new Date(Date.now() - 4 * 86400_000).toISOString() },
  { id: "d6", title: "Test-Broadcast (Dry-Run)", body: "Interne Test-Nachricht.", channel: "inapp", segment: { min_level: 30 }, recipient_count: 47, status: "pending", sent_at: null, sent_by_email: "admin@myarea365.de", created_at: new Date(Date.now() - 3600_000).toISOString() },
];

export function BroadcastsClient() {
  const [history, setHistory] = useState<Broadcast[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [channel, setChannel] = useState<"inapp" | "push" | "email">("inapp");
  const [faction, setFaction] = useState<"" | "syndicate" | "vanguard">("");
  const [country, setCountry] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const buildSegment = useCallback(() => ({
    ...(faction && { faction }),
    ...(country && { country }),
    ...(inactiveDays && { inactive_days: Number(inactiveDays) }),
    ...(minLevel && { min_level: Number(minLevel) }),
  }), [faction, country, inactiveDays, minLevel]);

  async function loadHistory() {
    const res = await fetch("/api/admin/broadcasts", { cache: "no-store" });
    const j = await res.json();
    const rows = (j.broadcasts ?? []) as Broadcast[];
    if (rows.length === 0) {
      setHistory(DEMO_BROADCASTS);
      setIsDemo(true);
    } else {
      setHistory(rows);
      setIsDemo(false);
    }
  }
  useEffect(() => { void loadHistory(); }, []);

  async function refreshPreview() {
    const seg = buildSegment();
    const res = await fetch(`/api/admin/broadcasts?preview=1&segment=${encodeURIComponent(JSON.stringify(seg))}`);
    const j = await res.json();
    setPreview(j.count ?? 0);
  }

  useEffect(() => {
    const t = setTimeout(() => void refreshPreview(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faction, country, inactiveDays, minLevel]);

  async function send(dry: boolean) {
    if (!title || !body) { alert("Titel und Text ausfüllen."); return; }
    const seg = buildSegment();
    const confirmMsg = dry
      ? "Dry-Run: nur loggen, nichts senden."
      : `${preview ?? 0} Empfänger erhalten diese Nachricht wirklich?`;
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, channel, segment: seg, dry_run: dry }),
      });
      const j = await res.json();
      if (!j.ok) { alert("Fehler: " + (j.error ?? "unbekannt")); return; }
      alert(`${dry ? "Gelogged" : "Gesendet"}: ${j.recipient_count} Empfänger`);
      if (!dry) { setTitle(""); setBody(""); }
      await loadHistory();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Neuer Broadcast</h2>

        <label className="block text-[11px] font-black tracking-widest text-[#8B8FA3] mb-1">TITEL</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Arena-Saison 2 beginnt!"
          className="w-full bg-[#0F1115] border border-white/10 rounded px-3 py-2 text-sm mb-3" />

        <label className="block text-[11px] font-black tracking-widest text-[#8B8FA3] mb-1">NACHRICHT</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Inhalt der Nachricht…"
          className="w-full bg-[#0F1115] border border-white/10 rounded px-3 py-2 text-sm mb-3" />

        <label className="block text-[11px] font-black tracking-widest text-[#8B8FA3] mb-1">KANAL</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}
          className="w-full bg-[#0F1115] border border-white/10 rounded px-3 py-2 text-sm mb-4">
          <option value="inapp">📱 In-App (Inbox)</option>
          <option value="push">🔔 Push (Stub)</option>
          <option value="email">📧 E-Mail (Stub)</option>
        </select>

        <h3 className="text-sm font-black tracking-wider text-[#FFD700] mb-2">ZIELGRUPPE</h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Field label="Fraktion">
            <select value={faction} onChange={(e) => setFaction(e.target.value as typeof faction)} className="w-full bg-[#0F1115] border border-white/10 rounded px-2 py-1.5 text-xs">
              <option value="">Alle</option>
              <option value="syndicate">🌙 Nachtpuls</option>
              <option value="vanguard">☀️ Sonnenwacht</option>
            </select>
          </Field>
          <Field label="Land">
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Deutschland" className="w-full bg-[#0F1115] border border-white/10 rounded px-2 py-1.5 text-xs" />
          </Field>
          <Field label="Inaktiv seit (Tage)">
            <input value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} placeholder="7" type="number" className="w-full bg-[#0F1115] border border-white/10 rounded px-2 py-1.5 text-xs" />
          </Field>
          <Field label="Min. Level">
            <input value={minLevel} onChange={(e) => setMinLevel(e.target.value)} placeholder="10" type="number" className="w-full bg-[#0F1115] border border-white/10 rounded px-2 py-1.5 text-xs" />
          </Field>
        </div>

        <div className="p-3 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 mb-4">
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">EMPFÄNGER (VORSCHAU)</div>
          <div className="text-2xl font-black text-white">{preview ?? "…"}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => send(true)} disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-bold text-[#a8b4cf] disabled:opacity-40">
            🧪 Dry-Run
          </button>
          <button onClick={() => send(false)} disabled={busy || !preview}
            className="flex-1 px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-sm font-bold disabled:opacity-40">
            📤 Senden ({preview ?? 0})
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Historie {isDemo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#a855f7]/20 border border-[#a855f7]/50 text-[#c084fc] font-black ml-2">🤖 DEMO</span>}</h2>
        {!history ? (
          <div className="text-sm text-[#8B8FA3]">Lade …</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-[#8B8FA3]">Noch keine Broadcasts.</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {history.map((b) => (
              <div key={b.id} className="p-3 rounded-lg bg-[#0F1115] border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-black text-white">{b.title}</div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                    b.status === "sent" ? "bg-[#4ade80]/15 text-[#4ade80]" :
                    b.status === "failed" ? "bg-[#FF2D78]/15 text-[#FF2D78]" :
                    "bg-white/10 text-[#a8b4cf]"
                  }`}>{b.status.toUpperCase()}</span>
                </div>
                <div className="text-xs text-[#a8b4cf] line-clamp-2">{b.body}</div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-[#6c7590]">
                  <span>📨 {b.recipient_count ?? 0} · {b.channel}</span>
                  <span>{new Date(b.created_at).toLocaleString("de-DE")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-1">{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

type Ticket = {
  id: string; email: string; name: string | null; subject: string; body: string;
  category: string; status: string; priority: string;
  created_at: string; resolved_at: string | null; internal_notes: string | null;
  source: string;
};

type Filter = "open" | "in_progress" | "resolved" | "all";

const DEMO_TICKETS: Ticket[] = [
  { id: "d1", email: "mia.r@example.com", name: "Mia R.", subject: "App zeigt GPS-Track falsch an", body: "Mein gestriger Lauf in Kreuzberg wurde nur zur Hälfte aufgezeichnet. Nach der Schönhauser Allee bricht der Track ab, obwohl ich weitergelaufen bin.", category: "bug", status: "open", priority: "high", created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), resolved_at: null, internal_notes: null, source: "contact_form" },
  { id: "d2", email: "oliver.p@example.com", name: "Oliver P.", subject: "Diamanten-Kauf fehlgeschlagen", body: "Habe 500 Diamanten gekauft, wurde abgebucht (€ 4,99) aber Diamanten nicht gutgeschrieben. Transaktions-ID: pi_3NxK9m2eZvKYlo2C1x5g3Rxg", category: "billing", status: "open", priority: "urgent", created_at: new Date(Date.now() - 45 * 60_000).toISOString(), resolved_at: null, internal_notes: null, source: "in_app" },
  { id: "d3", email: "kaffeehaus@example.com", name: "Café Luna", subject: "Partner-Integration Interesse", body: "Hallo, wir sind ein Café in Prenzlauer Berg und würden gerne als Partner mitmachen. Wie läuft der Prozess ab?", category: "partner", status: "in_progress", priority: "normal", created_at: new Date(Date.now() - 18 * 3600_000).toISOString(), resolved_at: null, internal_notes: "Demo gebucht für Freitag 14:00", source: "email" },
  { id: "d4", email: "titan@example.com", name: "Titan", subject: "Anderer Runner beleidigt mich im Chat", body: "User @raze schreibt mir ständig anstößige Nachrichten über die Crew-Mention. Bitte prüfen.", category: "abuse", status: "open", priority: "high", created_at: new Date(Date.now() - 6 * 3600_000).toISOString(), resolved_at: null, internal_notes: null, source: "in_app" },
  { id: "d5", email: "zephyr@example.com", name: "Zephyr", subject: "Wie funktioniert das Saison-Wächter-System?", body: "Ich habe gerade meinen Saison-Wächter gewählt, aber mein alter Wächter ist jetzt Level 1?", category: "general", status: "resolved", priority: "low", created_at: new Date(Date.now() - 3 * 86400_000).toISOString(), resolved_at: new Date(Date.now() - 2 * 86400_000).toISOString(), internal_notes: "Saison-Wächter vs. Ewiger Wächter erklärt — User zufrieden", source: "contact_form" },
  { id: "d6", email: "frost@example.com", name: "Frost", subject: "Arena-Kampf hängt", body: "Bei Klick auf 'Angreifen' lädt es ewig, nichts passiert. Chrome auf Android 14.", category: "bug", status: "in_progress", priority: "high", created_at: new Date(Date.now() - 4 * 3600_000).toISOString(), resolved_at: null, internal_notes: "Logs gecheckt, scheint Race-Condition in settle-RPC", source: "contact_form" },
  { id: "d7", email: "anonym@example.com", name: null, subject: "Login geht nicht mehr", body: "Bekomme seit heute morgen 'invalid credentials', obwohl Passwort korrekt ist.", category: "general", status: "open", priority: "normal", created_at: new Date(Date.now() - 90 * 60_000).toISOString(), resolved_at: null, internal_notes: null, source: "contact_form" },
  { id: "d8", email: "draven@example.com", name: "Draven", subject: "QR-Code am Kiosk nicht lesbar", body: "Der QR-Code beim Späti in der Bergmannstraße wird von der App nicht erkannt. Andere QRs funktionieren.", category: "bug", status: "resolved", priority: "normal", created_at: new Date(Date.now() - 5 * 86400_000).toISOString(), resolved_at: new Date(Date.now() - 4 * 86400_000).toISOString(), internal_notes: "QR-Code war abgenutzt, Partner hat neuen gedruckt", source: "in_app" },
];

export function SupportClient() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/support?filter=${filter}`, { cache: "no-store" });
    const j = await res.json();
    const apiRows = (j.tickets ?? []) as Ticket[];
    if (apiRows.length === 0) {
      const filtered = filter === "all" ? DEMO_TICKETS : DEMO_TICKETS.filter((t) => t.status === filter);
      setTickets(filtered);
      setIsDemo(true);
    } else {
      setTickets(apiRows);
      setIsDemo(false);
    }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  async function updateTicket(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", id, patch }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error); return; }
      await load();
      if (selected?.id === id) setSelected({ ...selected, ...patch } as Ticket);
    } finally { setBusy(false); }
  }

  return (
    <div>
      {isDemo && <DemoBanner />}
      <div className="flex gap-2 mb-4">
        {(["open","in_progress","resolved","all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              filter === f ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-[#a8b4cf]"
            }`}>
            {f === "open" ? "OFFEN" : f === "in_progress" ? "IN BEARBEITUNG" : f === "resolved" ? "GELÖST" : "ALLE"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        {/* Liste */}
        <div className="space-y-2 max-h-[640px] overflow-y-auto">
          {!tickets ? <div className="text-sm text-[#8B8FA3] p-4">Lade …</div>
            : tickets.length === 0 ? <div className="text-sm text-[#8B8FA3] p-4">Keine Tickets.</div>
            : tickets.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)}
                className={`w-full p-3 rounded-lg text-left border ${
                  selected?.id === t.id ? "bg-[#22D1C3]/10 border-[#22D1C3]/50" : "bg-[#0F1115] border-white/5 hover:border-white/15"
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-black text-white truncate">{t.subject}</div>
                  <PriorityBadge p={t.priority} />
                </div>
                <div className="text-[11px] text-[#a8b4cf] truncate">{t.email}</div>
                <div className="flex items-center justify-between mt-1">
                  <CategoryBadge c={t.category} />
                  <span className="text-[9px] text-[#6c7590]">{new Date(t.created_at).toLocaleString("de-DE")}</span>
                </div>
              </button>
            ))}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="p-8 text-center text-[#8B8FA3] text-sm rounded-lg bg-[#0F1115] border border-white/5">
              Ticket auswählen
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-[#0F1115] border border-white/5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-black text-white">{selected.subject}</div>
                  <div className="text-xs text-[#a8b4cf]">{selected.name ? `${selected.name} · ` : ""}{selected.email}</div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <PriorityBadge p={selected.priority} />
                  <CategoryBadge c={selected.category} />
                </div>
              </div>

              <div className="p-3 rounded bg-black/30 text-sm whitespace-pre-wrap text-[#dde3f5]">{selected.body}</div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5">
                <label className="text-[10px] font-black text-[#8B8FA3]">STATUS</label>
                <select value={selected.status} onChange={(e) => updateTicket(selected.id, { status: e.target.value, resolved_at: e.target.value === "resolved" ? new Date().toISOString() : null })}
                  disabled={busy}
                  className="bg-[#151922] border border-white/10 rounded px-2 py-1 text-xs">
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="resolved">Gelöst</option>
                  <option value="closed">Geschlossen</option>
                </select>
                <label className="text-[10px] font-black text-[#8B8FA3] ml-2">PRIORITÄT</label>
                <select value={selected.priority} onChange={(e) => updateTicket(selected.id, { priority: e.target.value })}
                  disabled={busy}
                  className="bg-[#151922] border border-white/10 rounded px-2 py-1 text-xs">
                  <option value="low">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hoch</option>
                  <option value="urgent">Dringend</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#8B8FA3] block mb-1">INTERNE NOTIZEN</label>
                <textarea
                  defaultValue={selected.internal_notes ?? ""}
                  rows={3}
                  onBlur={(e) => updateTicket(selected.id, { internal_notes: e.target.value })}
                  placeholder="Nur für Staff sichtbar…"
                  className="w-full bg-[#151922] border border-white/10 rounded px-3 py-2 text-xs" />
              </div>

              <div className="text-[10px] text-[#6c7590] pt-2 border-t border-white/5">
                Ticket-ID: <span className="font-mono">{selected.id}</span> · Source: {selected.source} · Created {new Date(selected.created_at).toLocaleString("de-DE")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="mb-3 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
      <span className="text-base">🤖</span>
      <span><b className="font-black tracking-wider">DEMO-DATEN</b> — Datenbank ist leer. Hier werden fiktive Tickets angezeigt, damit du die Oberfläche testen kannst.</span>
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const meta = p === "urgent" ? { c: "#FF2D78", l: "DRINGEND" }
             : p === "high"    ? { c: "#FF6B4A", l: "HOCH" }
             : p === "low"     ? { c: "#8B8FA3", l: "NIEDRIG" }
             :                    { c: "#22D1C3", l: "NORMAL" };
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background: `${meta.c}22`, color: meta.c }}>{meta.l}</span>;
}
function CategoryBadge({ c }: { c: string }) {
  const map: Record<string, string> = {
    bug: "🐛", billing: "💳", partner: "🤝", abuse: "⚠️", general: "💬", other: "📎",
  };
  return <span className="text-[10px] text-[#a8b4cf]">{map[c] ?? "📎"} {c}</span>;
}

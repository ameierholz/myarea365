"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, Input, Textarea, Select } from "../_components/ui";
import type { EventRow } from "./page";

const EVENT_KINDS = [
  { id: "double_xp",       label: "🚀 Double-XP",       hint: "XP-Multiplikator 2x in dem Zeitfenster" },
  { id: "hunt_reset",      label: "🎯 Hunt-Reset",       hint: "Setzt alle Wegelager-Cooldowns zurück" },
  { id: "wegelager_storm", label: "⛈️ Wegelager-Storm",  hint: "Erhöhte Spawnrate von Wegelagern" },
  { id: "crown_drop",      label: "👑 Crown-Drop",       hint: "Bonus-Crowns für jede gelaufene km" },
  { id: "crew_war",        label: "⚔️ Turf-Krieg",       hint: "Aktiviert Turf-Kriegs-Modus für die Dauer" },
  { id: "custom",          label: "🛠️ Custom",            hint: "Frei konfigurierbar (payload JSON)" },
] as const;

export function EventsClient({ initial }: { initial: EventRow[] }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<typeof EVENT_KINDS[number]["id"]>("double_xp");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 16));
  const [end, setEnd] = useState(new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [notify, setNotify] = useState(true);
  const [notifyText, setNotifyText] = useState("");
  const [payloadStr, setPayloadStr] = useState("{}");

  async function create() {
    setBusy(true);
    try {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(payloadStr || "{}"); } catch { alert("Payload ist kein gültiges JSON"); setBusy(false); return; }
      const r = await fetch("/api/admin/events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", event_kind: kind, payload, starts_at: new Date(start).toISOString(), ends_at: end ? new Date(end).toISOString() : null, notify_users: notify, notify_text: notifyText || null }),
      });
      if (r.ok) { setShow(false); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function action(id: string, action: "cancel" | "end_now") {
    if (action === "cancel" && !confirm("Event wirklich abbrechen?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShow((v) => !v)}>{show ? "× Schließen" : "+ Neues Event"}</Button>
      </div>

      {show && (
        <Card className="mb-6">
          <h2 className="font-bold mb-3">Neues Event triggern</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] uppercase text-[#8b8fa3]">Event-Typ</label>
              <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-full">
                {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </Select>
              <div className="text-[10px] text-[#8b8fa3] mt-1">{EVENT_KINDS.find((k) => k.id === kind)?.hint}</div>
            </div>
            <div></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Start</label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Ende</label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="mb-3">
            <label className="text-[11px] uppercase text-[#8b8fa3]">Payload (JSON, optional)</label>
            <Textarea value={payloadStr} onChange={(e) => setPayloadStr(e.target.value)} rows={3} placeholder='z.B. {"multiplier": 2}' />
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" id="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <label htmlFor="notify" className="text-sm">User-Benachrichtigung senden</label>
          </div>
          {notify && (
            <div className="mb-3">
              <label className="text-[11px] uppercase text-[#8b8fa3]">Benachrichtigungs-Text</label>
              <Textarea value={notifyText} onChange={(e) => setNotifyText(e.target.value)} rows={2} placeholder="z.B. Ab jetzt 2x XP für 24h!" />
            </div>
          )}
          <Button onClick={create} disabled={busy}>{busy ? "Erstelle…" : "Event starten"}</Button>
        </Card>
      )}

      <div className="space-y-2">
        {initial.length === 0 && <Card><p className="text-sm text-[#8b8fa3]">Noch keine Events ausgelöst.</p></Card>}
        {initial.map((e) => {
          const now = Date.now();
          const start = new Date(e.starts_at).getTime();
          const end = e.ends_at ? new Date(e.ends_at).getTime() : Infinity;
          const live = e.status !== "cancelled" && e.status !== "ended" && start <= now && now <= end;
          const meta = EVENT_KINDS.find((k) => k.id === e.event_kind);
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{meta?.label ?? e.event_kind}</span>
                    <Badge tone={live ? "success" : e.status === "cancelled" ? "danger" : e.status === "ended" ? "neutral" : "warning"}>{live ? "LIVE" : e.status}</Badge>
                    {e.notify_users && <span className="text-[10px] text-[#22D1C3]">📢 Notify</span>}
                  </div>
                  <div className="text-[11px] text-[#8b8fa3]">
                    {new Date(e.starts_at).toLocaleString("de-DE")} → {e.ends_at ? new Date(e.ends_at).toLocaleString("de-DE") : "∞"}
                  </div>
                  {e.notify_text && <div className="text-xs italic text-[#dde3f5] mt-1">"{e.notify_text}"</div>}
                  {Object.keys(e.payload || {}).length > 0 && (
                    <div className="text-[10px] font-mono text-[#8b8fa3] mt-1 truncate">payload: {JSON.stringify(e.payload)}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {live && <Button size="sm" variant="danger" onClick={() => action(e.id, "end_now")}>Jetzt beenden</Button>}
                  {e.status === "scheduled" && <Button size="sm" variant="secondary" onClick={() => action(e.id, "cancel")}>Cancel</Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

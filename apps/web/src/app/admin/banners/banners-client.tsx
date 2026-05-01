"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, Input, Textarea, Select } from "../_components/ui";
import type { BannerRow } from "./page";

const COLOR_PRESETS = [
  { name: "Cyan", bg: "#22D1C3", fg: "#0F1115" },
  { name: "Pink", bg: "#FF2D78", fg: "#FFFFFF" },
  { name: "Gold", bg: "#FFD700", fg: "#0F1115" },
  { name: "Lila", bg: "#a855f7", fg: "#FFFFFF" },
  { name: "Orange", bg: "#FF6B4A", fg: "#FFFFFF" },
];

export function BannersClient({ initial }: { initial: BannerRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<BannerRow> | null>(null);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing({
      title: "", body: "", target: "all", dismissible: true, active: true,
      background_color: "#22D1C3", text_color: "#0F1115", priority: 0,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const action = editing.id ? "update" : "create";
      const r = await fetch("/api/admin/banners", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...editing }),
      });
      if (r.ok) { setEditing(null); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function toggle(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/banners", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Banner wirklich löschen?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/banners", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>+ Neuer Banner</Button>
      </div>

      {editing && (
        <Card className="mb-6">
          <h2 className="font-bold mb-3">{editing.id ? "Banner bearbeiten" : "Neuer Banner"}</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Titel</label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Priorität (höher = wichtiger)</label><Input type="number" value={String(editing.priority ?? 0)} onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <div className="mb-3"><label className="text-[11px] uppercase text-[#8b8fa3]">Body</label><Textarea value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={2} /></div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">CTA-Label (optional)</label><Input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} placeholder="z.B. Jetzt mitmachen" /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">CTA-Link (optional)</label><Input value={editing.cta_href ?? ""} onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })} placeholder="z.B. /missions" /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[11px] uppercase text-[#8b8fa3]">Target</label>
              <Select value={editing.target ?? "all"} onChange={(e) => setEditing({ ...editing, target: e.target.value })} className="w-full">
                <option value="all">Alle Runner</option>
                <option value="segment:active">Aktive (7d)</option>
                <option value="segment:inactive">Inaktive (&gt;30d)</option>
                <option value="segment:high_xp">High-XP (&gt;10k)</option>
              </Select>
            </div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Start</label><Input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Ende (optional)</label><Input type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></div>
          </div>
          <div className="mb-3">
            <label className="text-[11px] uppercase text-[#8b8fa3] mb-2 block">Farb-Preset</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map((p) => (
                <button key={p.name} onClick={() => setEditing({ ...editing, background_color: p.bg, text_color: p.fg })}
                  style={{ background: p.bg, color: p.fg }} className="px-3 py-1.5 rounded-lg text-xs font-bold">{p.name}</button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" id="dismissible" checked={editing.dismissible ?? true} onChange={(e) => setEditing({ ...editing, dismissible: e.target.checked })} />
            <label htmlFor="dismissible" className="text-sm">Vom User schließbar</label>
          </div>
          <div className="mb-4 p-3 rounded-lg" style={{ background: editing.background_color ?? "#22D1C3", color: editing.text_color ?? "#0F1115" }}>
            <div className="font-bold">{editing.title || "Vorschau-Titel"}</div>
            <div className="text-sm">{editing.body || "Vorschau-Body…"}</div>
            {editing.cta_label && <button className="mt-2 px-3 py-1.5 rounded bg-black/20 text-xs font-bold">{editing.cta_label} →</button>}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>{busy ? "Speichere…" : "Speichern"}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {initial.length === 0 && <Card><p className="text-sm text-[#8b8fa3]">Noch keine Banner angelegt.</p></Card>}
        {initial.map((b) => {
          const now = Date.now();
          const start = new Date(b.starts_at).getTime();
          const end = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
          const live = b.active && start <= now && now <= end;
          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge tone={live ? "success" : b.active ? "warning" : "neutral"}>{live ? "LIVE" : b.active ? "geplant" : "inaktiv"}</Badge>
                    <span className="text-[11px] text-[#8b8fa3]">target: {b.target}</span>
                    <span className="text-[11px] text-[#8b8fa3]">prio: {b.priority}</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: b.background_color ?? "#22D1C3", color: b.text_color ?? "#0F1115" }}>
                    <div className="font-bold">{b.title}</div>
                    <div className="text-sm">{b.body}</div>
                    {b.cta_label && <div className="mt-2 text-xs underline">{b.cta_label} →</div>}
                  </div>
                  <div className="text-[10px] text-[#8b8fa3] mt-2">
                    {new Date(b.starts_at).toLocaleString("de-DE")} → {b.ends_at ? new Date(b.ends_at).toLocaleString("de-DE") : "∞"}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => toggle(b.id)}>{b.active ? "Aus" : "An"}</Button>
                  <Button size="sm" variant="danger" onClick={() => del(b.id)}>×</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

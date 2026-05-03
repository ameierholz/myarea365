"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Template = {
  kind: string;
  category: string;
  title: string;
  body: string;
  emoji: string;
  color: string;
  hero_label: string;
  default_reward: Record<string, unknown>;
  available_vars: string[];
  description: string;
  active: boolean;
  updated_at: string;
};

type Preview = { title: string; body: string; emoji: string; color: string; hero_label: string; default_reward: Record<string, unknown> };

const ACCENT = "#22D1C3";
const BG = "#0F1115";

export function SystemMessagesClient() {
  const [list, setList] = useState<Template[]>([]);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/system-messages");
    if (!r.ok) return;
    const j = await r.json() as { templates: Template[] };
    setList(j.templates);
    if (!selectedKind && j.templates.length > 0) setSelectedKind(j.templates[0].kind);
  }, [selectedKind]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedKind) return;
    const t = list.find((x) => x.kind === selectedKind);
    if (t) setDraft(t);
  }, [selectedKind, list]);

  const refreshPreview = useCallback(async (d: Template | null) => {
    if (!d) { setPreview(null); return; }
    const r = await fetch("/api/admin/system-messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: d.kind }),
    });
    if (!r.ok) { setPreview(null); return; }
    setPreview(await r.json());
  }, []);

  // Preview live mit Draft-Inhalt rendern (Client-seitig, ohne Server-Roundtrip)
  const livePreview = useMemo(() => {
    if (!draft) return null;
    const demoVars: Record<string, string> = {
      runner_name: "Kaelthor", crew_name: "Kaelthors Kiez-Crew",
      gems: "100", wood: "1000", stone: "750", gold: "1000", mana: "500",
      item_name: "Goldene Truhe", item_count: "2",
      chest_kind: "Eroberer", set_name: "Wächter-Chroniken",
      sender_name: "Aurelius", level: "3", points: "200", sku: "mpack_small",
      survey_title: "Erste Eindrücke", guardian_name: "Khael Sturmflügel",
      offer_name: "Erstläufer-Paket", kind: "google", emoji: "🔐", label: "Google verknüpft",
    };
    const fmt = (s: string) => Object.entries(demoVars).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v), s
    );
    return { title: fmt(draft.title), body: fmt(draft.body), emoji: draft.emoji, color: draft.color, hero_label: draft.hero_label };
  }, [draft]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/system-messages", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind, title: draft.title, body: draft.body,
          emoji: draft.emoji, color: draft.color, hero_label: draft.hero_label,
          category: draft.category, active: draft.active,
        }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (j?.ok) {
        setToast("✓ Gespeichert");
        await load();
        await refreshPreview(draft);
      } else {
        setToast(j?.error ?? "Fehler beim Speichern");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  function update<K extends keyof Template>(k: K, v: Template[K]) {
    setDraft((d) => d ? { ...d, [k]: v } : d);
  }

  function insertVar(name: string) {
    const tag = `{{${name}}}`;
    const ta = document.getElementById("body-textarea") as HTMLTextAreaElement | null;
    if (!ta || !draft) return;
    const start = ta.selectionStart ?? draft.body.length;
    const end = ta.selectionEnd ?? draft.body.length;
    const next = draft.body.slice(0, start) + tag + draft.body.slice(end);
    update("body", next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  }

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-black tracking-tight mb-1">📬 System-Nachrichten</h1>
        <p className="text-sm text-white/60 mb-6">
          Jede automatische System-Nachricht im Posteingang basiert auf einem Template.
          Bearbeite Titel, Body, Emoji und Akzent-Farbe live — Änderungen werden für künftige Nachrichten verwendet.
          Platzhalter wie <code className="px-1 py-0.5 bg-white/10 rounded">{`{{runner_name}}`}</code> werden zur Sendezeit ersetzt.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_360px] gap-4">
          {/* Sidebar: Liste */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
            {list.map((t) => (
              <button key={t.kind} onClick={() => setSelectedKind(t.kind)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 ${selectedKind === t.kind ? "bg-white/10" : "hover:bg-white/5"}`}>
                <span className="text-xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black truncate">{t.kind}</div>
                  <div className="text-[10px] text-white/50 truncate">{t.title}</div>
                </div>
                {!t.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">aus</span>}
              </button>
            ))}
          </div>

          {/* Editor */}
          {draft ? (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <input value={draft.emoji} onChange={(e) => update("emoji", e.target.value)}
                  className="w-14 h-14 text-3xl text-center rounded-lg bg-black/40 border border-white/15"
                  maxLength={4} />
                <div className="flex-1">
                  <div className="text-[10px] font-black tracking-[1.5px] text-white/40">KIND</div>
                  <div className="text-base font-black">{draft.kind}</div>
                </div>
                <label className="flex items-center gap-2 text-[11px]">
                  <input type="checkbox" checked={draft.active} onChange={(e) => update("active", e.target.checked)} />
                  Aktiv
                </label>
              </div>

              {draft.description && (
                <div className="text-[11px] text-white/50 italic px-2 py-1.5 bg-black/30 rounded">{draft.description}</div>
              )}

              <Field label="Hero-Label (kleine Überschrift)">
                <input value={draft.hero_label} onChange={(e) => update("hero_label", e.target.value)}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/15 text-sm" />
              </Field>

              <Field label="Akzent-Farbe">
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.color} onChange={(e) => update("color", e.target.value)}
                    className="w-12 h-10 rounded bg-transparent border border-white/15 cursor-pointer" />
                  <input value={draft.color} onChange={(e) => update("color", e.target.value)}
                    className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/15 text-sm font-mono" />
                </div>
              </Field>

              <Field label="Titel">
                <input value={draft.title} onChange={(e) => update("title", e.target.value)}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/15 text-sm" />
              </Field>

              <Field label="Body (Markdown-light: **fett**)">
                <textarea id="body-textarea" value={draft.body} onChange={(e) => update("body", e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/15 text-sm font-mono leading-relaxed" />
              </Field>

              {/* Platzhalter-Buttons */}
              {draft.available_vars.length > 0 && (
                <div>
                  <div className="text-[10px] font-black tracking-[1.5px] text-white/40 mb-2">PLATZHALTER (klicken zum Einfügen)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["runner_name", "crew_name", ...draft.available_vars.filter((v) => v !== "runner_name" && v !== "crew_name")].map((v) => (
                      <button key={v} onClick={() => insertVar(v)}
                        className="text-[11px] font-mono px-2 py-1 rounded bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-[#22D1C3] hover:bg-[#22D1C3]/25">
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex gap-2">
                <button onClick={save} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg font-black text-sm"
                  style={{ background: ACCENT, color: BG, opacity: saving ? 0.5 : 1 }}>
                  {saving ? "Speichern…" : "💾 Speichern"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center text-white/60">
              Wähle eine Nachricht aus der Liste links.
            </div>
          )}

          {/* Live-Preview */}
          {livePreview && (
            <div className="space-y-2">
              <div className="text-[10px] font-black tracking-[1.5px] text-white/40">LIVE-VORSCHAU</div>
              <div className="rounded-xl bg-gradient-to-b from-[#1a1d23] to-[#0F1115] border border-white/10 p-4 space-y-3">
                {/* Hero-Header */}
                <div className="rounded-xl p-3 flex items-center gap-3"
                     style={{ background: `linear-gradient(135deg, ${livePreview.color}22, transparent)`, border: `1px solid ${livePreview.color}44` }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                       style={{ background: `${livePreview.color}33`, border: `1.5px solid ${livePreview.color}` }}>
                    {livePreview.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-black tracking-[1.5px]" style={{ color: livePreview.color }}>
                      {livePreview.hero_label.toUpperCase()}
                    </div>
                    <div className="text-[14px] font-black">{livePreview.title}</div>
                  </div>
                </div>
                {/* Body mit **bold** */}
                <div className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap">
                  {livePreview.body.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**")
                      ? <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>
                      : <span key={i}>{part}</span>
                  )}
                </div>
                <div className="text-[10px] text-white/30 italic pt-2 border-t border-white/10">
                  Vorschau mit Demo-Daten (runner_name=Kaelthor, gems=100, …)
                </div>
              </div>
              {preview && JSON.stringify(preview) !== JSON.stringify(livePreview) && (
                <div className="text-[10px] text-white/40">
                  Server-Stand weicht ab — auf Speichern klicken um Änderungen zu übernehmen.
                </div>
              )}
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/90 border border-white/15 text-sm font-black z-50">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[1.5px] text-white/40 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

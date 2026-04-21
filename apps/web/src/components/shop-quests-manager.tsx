"use client";

import { useEffect, useState } from "react";

type Quest = {
  id: string;
  title: string;
  description: string | null;
  article_pattern: string;
  reward_xp: number;
  reward_loot_rarity: "common" | "rare" | "epic" | "legendary" | null;
  active: boolean;
  starts_at: string;
  expires_at: string | null;
  max_completions_per_user: number;
  total_completions: number;
  created_at: string;
};

const RARITY_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: "",          label: "Kein Loot-Drop", color: "#8B8FA3" },
  { value: "common",    label: "Common-Item",   color: "#8B8FA3" },
  { value: "rare",      label: "Rare-Item",     color: "#22D1C3" },
  { value: "epic",      label: "Epic-Item",     color: "#a855f7" },
  { value: "legendary", label: "Legendary-Item",color: "#FFD700" },
];

export function ShopQuestsManager({ businessId }: { businessId: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    article_pattern: "",
    reward_xp: "200",
    reward_loot_rarity: "",
    expires_at: "",
    max_completions_per_user: "1",
  });

  async function reload() {
    setLoading(true);
    const res = await fetch(`/api/partner/quests?business_id=${businessId}`, { cache: "no-store" });
    if (res.ok) setQuests((await res.json()).quests ?? []);
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function createQuest(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/partner/quests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        business_id: businessId,
        title: form.title,
        description: form.description || undefined,
        article_pattern: form.article_pattern,
        reward_xp: parseInt(form.reward_xp) || 0,
        reward_loot_rarity: form.reward_loot_rarity || null,
        max_completions_per_user: parseInt(form.max_completions_per_user) || 1,
        expires_at: form.expires_at || null,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ title: "", description: "", article_pattern: "", reward_xp: "200", reward_loot_rarity: "", expires_at: "", max_completions_per_user: "1" });
      await reload();
    } else {
      const j = await res.json().catch(() => ({}));
      alert("Fehler: " + (j.error ?? res.status));
    }
  }

  async function toggleActive(q: Quest) {
    await fetch("/api/partner/quests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: q.id, active: !q.active }),
    });
    await reload();
  }

  async function removeQuest(q: Quest) {
    if (!confirm(`Quest "${q.title}" löschen?`)) return;
    await fetch(`/api/partner/quests?id=${q.id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-white">📋 Shop-Quests</h2>
          <p className="text-xs text-[#a8b4cf]">Runner lösen Quests automatisch beim Bon-Upload ein (KI erkennt Artikel).</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-sm font-bold">
          {showForm ? "Abbrechen" : "+ Neue Quest"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createQuest} className="p-4 rounded-xl bg-[#1A1D23] border border-white/10 mb-4 space-y-3">
          <FormField label="Titel (für Runner sichtbar)">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder='z.B. "Kaufe eine Winterjacke"' className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </FormField>
          <FormField label='Artikel-Muster (Substring-Match auf Kassenbon — z.B. "Jacke" matcht "Winterjacke Damen Gr.M")'>
            <input required value={form.article_pattern} onChange={(e) => setForm({ ...form, article_pattern: e.target.value })}
              placeholder='z.B. "Jacke"' className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </FormField>
          <FormField label="Beschreibung (optional)">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="XP-Belohnung (max 5000)">
              <input type="number" min={0} max={5000} value={form.reward_xp} onChange={(e) => setForm({ ...form, reward_xp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
            </FormField>
            <FormField label="Loot-Drop">
              <select value={form.reward_loot_rarity} onChange={(e) => setForm({ ...form, reward_loot_rarity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white">
                {RARITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Max. Einlösungen pro Runner">
              <input type="number" min={1} max={99} value={form.max_completions_per_user} onChange={(e) => setForm({ ...form, max_completions_per_user: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
            </FormField>
            <FormField label="Läuft ab (optional)">
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
            </FormField>
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#22D1C3] to-[#FFD700] text-[#0F1115] font-bold text-sm">
            Quest anlegen
          </button>
        </form>
      )}

      {loading ? (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>
      ) : quests.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">Noch keine Quests. Leg eine an um Runner zu besonderen Käufen zu motivieren.</div>
      ) : (
        <div className="space-y-2">
          {quests.map((q) => {
            const rarity = RARITY_OPTIONS.find((r) => r.value === (q.reward_loot_rarity ?? ""));
            return (
              <div key={q.id} className={`p-3 rounded-xl border ${q.active ? "bg-[#1A1D23] border-white/10" : "bg-[#1A1D23]/50 border-white/5 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{q.title}</span>
                      {!q.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#8B8FA3]/20 text-[#8B8FA3] font-bold">PAUSIERT</span>}
                      {q.expires_at && new Date(q.expires_at) < new Date() && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF2D78]/20 text-[#FF2D78] font-bold">ABGELAUFEN</span>}
                    </div>
                    <div className="text-[11px] text-[#a8b4cf] mt-1">
                      Pattern: <code className="text-[#22D1C3]">{q.article_pattern}</code>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#8B8FA3] mt-1.5">
                      {q.reward_xp > 0 && <span>⚡ +{q.reward_xp} XP</span>}
                      {q.reward_loot_rarity && <span style={{ color: rarity?.color }}>🎁 {rarity?.label}</span>}
                      <span>👥 {q.total_completions}× eingelöst</span>
                      <span>· max {q.max_completions_per_user}/Runner</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => toggleActive(q)} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#a8b4cf] font-bold">
                      {q.active ? "Pausieren" : "Aktivieren"}
                    </button>
                    <button onClick={() => removeQuest(q)} className="text-[10px] px-2 py-1 rounded-lg bg-[#FF2D78]/15 hover:bg-[#FF2D78]/25 text-[#FF2D78] font-bold">
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold tracking-wider text-[#8B8FA3] uppercase mb-1">{label}</div>
      {children}
    </label>
  );
}

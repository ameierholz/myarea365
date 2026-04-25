"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";

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

export function ShopQuestsManager({ businessId }: { businessId: string }) {
  const tSQ = useTranslations("ShopQuests");
  const RARITY_OPTIONS: Array<{ value: string; label: string; color: string }> = useMemo(() => [
    { value: "",          label: tSQ("lootNone"),     color: "#8B8FA3" },
    { value: "common",    label: tSQ("lootCommon"),   color: "#8B8FA3" },
    { value: "rare",      label: tSQ("lootRare"),     color: "#22D1C3" },
    { value: "epic",      label: tSQ("lootEpic"),     color: "#a855f7" },
    { value: "legendary", label: tSQ("lootLegendary"),color: "#FFD700" },
  ], [tSQ]);

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
      alert(tSQ("errorPrefix", { error: String(j.error ?? res.status) }));
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
    if (!confirm(tSQ("deleteConfirm", { title: q.title }))) return;
    await fetch(`/api/partner/quests?id=${q.id}`, { method: "DELETE" });
    await reload();
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white focus:outline-none focus:border-[#22D1C3] focus:ring-1 focus:ring-[#22D1C3]/30 transition";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white flex items-center gap-2">{tSQ("title")}</h2>
          <p className="text-xs text-[#a8b4cf]">{tSQ("subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 16px", borderRadius: 10, whiteSpace: "nowrap", cursor: "pointer",
            border: "none", fontSize: 13, fontWeight: 900, letterSpacing: 0.5,
            background: showForm
              ? "rgba(255, 45, 120, 0.15)"
              : "linear-gradient(135deg, #22D1C3 0%, #0f8178 100%)",
            color: showForm ? "#FF2D78" : "#0F1115",
            boxShadow: showForm ? "none" : "0 4px 14px rgba(34, 209, 195, 0.3)",
          }}
        >
          {showForm ? tSQ("cancelButton") : tSQ("newQuest")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createQuest}
          className="p-5 rounded-2xl mb-4 space-y-4"
          style={{
            background: "radial-gradient(ellipse at top, rgba(34, 209, 195, 0.08), transparent 60%), #1A1D23",
            border: "1px solid rgba(34, 209, 195, 0.25)",
          }}>
          <FormField label={tSQ("fieldTitle")}>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tSQ("fieldTitlePh")} className={inputClass} />
          </FormField>
          <FormField label={tSQ("fieldPattern")}>
            <input required value={form.article_pattern} onChange={(e) => setForm({ ...form, article_pattern: e.target.value })}
              placeholder={tSQ("fieldPatternPh")} className={inputClass} />
          </FormField>
          <FormField label={tSQ("fieldDescription")}>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className={inputClass}
              placeholder={tSQ("fieldDescriptionPh")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={tSQ("fieldXp")}>
              <input type="number" min={0} max={5000} value={form.reward_xp}
                onChange={(e) => setForm({ ...form, reward_xp: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label={tSQ("fieldLoot")}>
              <select value={form.reward_loot_rarity}
                onChange={(e) => setForm({ ...form, reward_loot_rarity: e.target.value })} className={inputClass}>
                {RARITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={tSQ("fieldMaxCompletions")}>
              <input type="number" min={1} max={99} value={form.max_completions_per_user}
                onChange={(e) => setForm({ ...form, max_completions_per_user: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label={tSQ("fieldExpires")}>
              <input type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={inputClass} />
            </FormField>
          </div>
          <button type="submit"
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 12,
              border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #22D1C3 0%, #FFD700 100%)",
              color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 1,
              boxShadow: "0 6px 20px rgba(34, 209, 195, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
            }}>
            {tSQ("createButton")}
          </button>
        </form>
      )}

      {loading ? (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">{tSQ("loading")}</div>
      ) : quests.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm font-bold text-white mb-1">{tSQ("noQuestsTitle")}</div>
          <div className="text-xs text-[#8B8FA3] max-w-sm mx-auto">
            {tSQ("noQuestsHint")}
          </div>
        </div>
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
                      {!q.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#8B8FA3]/20 text-[#8B8FA3] font-bold">{tSQ("badgePaused")}</span>}
                      {q.expires_at && new Date(q.expires_at) < new Date() && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF2D78]/20 text-[#FF2D78] font-bold">{tSQ("badgeExpired")}</span>}
                    </div>
                    <div className="text-[11px] text-[#a8b4cf] mt-1">
                      {tSQ("patternLabel")} <code className="text-[#22D1C3]">{q.article_pattern}</code>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#8B8FA3] mt-1.5">
                      {q.reward_xp > 0 && <span>⚡ +{q.reward_xp} XP</span>}
                      {q.reward_loot_rarity && <span style={{ color: rarity?.color }}>🎁 {rarity?.label}</span>}
                      <span>{tSQ("redeemed", { count: q.total_completions })}</span>
                      <span>{tSQ("maxPerRunner", { count: q.max_completions_per_user })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => toggleActive(q)} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#a8b4cf] font-bold">
                      {q.active ? tSQ("pause") : tSQ("activate")}
                    </button>
                    <button onClick={() => removeQuest(q)} className="text-[10px] px-2 py-1 rounded-lg bg-[#FF2D78]/15 hover:bg-[#FF2D78]/25 text-[#FF2D78] font-bold">
                      {tSQ("delete")}
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

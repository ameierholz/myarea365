"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ARTWORK_RACES, ARTWORK_SLOTS, ARTWORK_RARITIES,
  buildPrompt, buildArchetypePrompt,
  type ArtworkSlot, type ArtworkRarity, type GeneratedPrompt,
} from "@/lib/artwork-prompts";

type Archetype = {
  id: string; name: string; emoji: string; rarity: string; image_url: string | null;
  guardian_type: "infantry" | "cavalry" | "marksman" | "mage" | null;
  role: "dps" | "tank" | "support" | "balanced" | null;
  ability_name: string | null; lore: string | null;
};
type Item      = { id: string; name: string; emoji: string; slot: string; rarity: string; image_url: string | null; cosmetic_only: boolean; race: string | null };
type RaceLore  = { name: string; role: string; lore: string | null; material_desc: string | null; energy_color: string | null };

type Tab = "archetypes" | "items" | "prompts";

const RARITY_LABEL: Record<string, { label: string; color: string }> = {
  elite:     { label: "ELITE",     color: "#22D1C3" },
  epic:      { label: "EPISCH",    color: "#a855f7" },
  legendary: { label: "LEGENDÄR",  color: "#FFD700" },
  common:    { label: "ELITE",     color: "#22D1C3" },
  rare:      { label: "ELITE",     color: "#22D1C3" },
  legend:    { label: "LEGENDÄR",  color: "#FFD700" },
};

const TYPE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};

const ROLE_LABEL: Record<string, string> = {
  dps: "DPS", tank: "Tank", support: "Support", balanced: "Balanced",
};

// Mapping Prompt-Rarity (DE-Label) -> DB-Rarity (Items)
const PROMPT_RARITY_TO_DB: Record<string, string> = {
  "Ungewöhnlich": "common", "Selten": "rare", "Episch": "epic", "Legendär": "legend",
  "Artefakt": "artifact", "Transzendent": "transcendent",
};
const PROMPT_SLOT_TO_DB: Record<string, string> = {
  "Helm": "helm", "Halskette": "neck", "Schultern": "shoulders", "Brustplatte": "chest",
  "Gürtel": "waist", "Hose": "legs", "Stiefel": "boots", "Armschienen": "wrist",
  "Handschuhe": "hands", "Ring": "ring", "Umhang": "back", "Schmuckstück": "trinket",
  "Haupthand-Waffe": "weapon", "Nebenhand": "offhand", "Rücken": "back",
};

function findMatchingItem(items: Item[], race: string, slot: string, rarityLabel: string): Item | null {
  const dbRarity = PROMPT_RARITY_TO_DB[rarityLabel];
  const dbSlot   = PROMPT_SLOT_TO_DB[slot];
  if (!dbRarity || !dbSlot) return null;
  return items.find((i) => i.race === race && i.rarity === dbRarity && i.slot === dbSlot) ?? null;
}

export function ArtworkAdminClient() {
  const [tab, setTab] = useState<Tab>("archetypes");
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [races, setRaces] = useState<RaceLore[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/artwork", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setArchetypes(data.archetypes);
      setItems(data.items);
      setRaces(data.races ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">🎨 Artwork-Generator</h1>
      <p className="text-sm text-[#a8b4cf] mb-4">
        Generiere KI-Prompts für Scenario.gg / Canova Pro / Midjourney und lade die fertigen Bilder direkt zu den 60 Wächtern und Items hoch.
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: "archetypes", label: `🛡️ 60 Wächter (${archetypes.filter(a => a.image_url).length}/${archetypes.length})` },
          { id: "items",      label: `⚔️ Item-Bilder (${items.filter(i => i.image_url).length}/${items.length})` },
          { id: "prompts",    label: "🎲 Prompt-Generator (1800)" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === t.id ? "bg-[#22D1C3] text-[#0F1115]" : "bg-[#1A1D23] text-[#a8b4cf] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "archetypes" && (loading ? <LoadingBox /> : <ArchetypesTab archetypes={archetypes} onChange={reload} />)}
      {tab === "items" && (loading ? <LoadingBox /> : <ItemsTab items={items} races={races} onChange={reload} />)}
      {tab === "prompts" && <PromptsTab items={items} onChange={reload} />}
    </div>
  );
}

function LoadingBox() {
  return <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>;
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Wächter-Bilder (60 Archetypes)                       */
/* ═════════════════════════════════════════════════════════ */
function ArchetypesTab({ archetypes, onChange }: { archetypes: Archetype[]; onChange: () => void }) {
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterType,   setFilterType]   = useState<string>("ALL");
  const [filterRole,   setFilterRole]   = useState<string>("ALL");
  const [search,       setSearch]       = useState("");
  const [missingOnly,  setMissingOnly]  = useState(false);

  const filtered = useMemo(() => archetypes.filter((a) => {
    if (filterRarity !== "ALL" && a.rarity !== filterRarity) return false;
    if (filterType !== "ALL" && a.guardian_type !== filterType) return false;
    if (filterRole !== "ALL" && a.role !== filterRole) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (missingOnly && a.image_url) return false;
    return true;
  }), [archetypes, filterRarity, filterType, filterRole, search, missingOnly]);

  const done = archetypes.filter(a => a.image_url).length;
  const pct = archetypes.length > 0 ? Math.round((done / archetypes.length) * 100) : 0;

  const exportCsv = () => {
    const header = "id,name,rarity,type,role,ability,has_image,prompt";
    const rows = filtered.map((a) => [
      a.id, `"${a.name}"`, a.rarity, a.guardian_type ?? "", a.role ?? "",
      `"${a.ability_name ?? ""}"`, a.image_url ? "yes" : "no",
      `"${buildArchetypePrompt({ name: a.name, rarity: a.rarity as "elite" | "epic" | "legendary", guardianType: a.guardian_type, role: a.role, abilityName: a.ability_name, lore: a.lore }).replace(/"/g, '""')}"`,
    ].join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `waechter-prompts-${new Date().toISOString().slice(0,10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Filter-Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Raritäten</option>
          <option value="elite">Elite</option>
          <option value="epic">Episch</option>
          <option value="legendary">Legendär</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Typen</option>
          <option value="infantry">🛡️ Infanterie</option>
          <option value="cavalry">🐎 Kavallerie</option>
          <option value="marksman">🏹 Scharfschütze</option>
          <option value="mage">🔮 Magier</option>
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rollen</option>
          <option value="dps">DPS</option>
          <option value="tank">Tank</option>
          <option value="support">Support</option>
          <option value="balanced">Balanced</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche Name/ID…"
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Nur ohne Bild
        </label>
        <button onClick={exportCsv} className="bg-[#22D1C3] text-[#0F1115] rounded-lg px-3 py-2 text-sm font-bold">
          ⬇️ CSV ({filtered.length})
        </button>
      </div>

      {/* Progress-Bar */}
      <div className="mb-4 p-3 rounded-xl bg-[#1A1D23] border border-white/10">
        <div className="flex items-center justify-between mb-2 text-xs text-[#a8b4cf]">
          <span><strong className="text-white">{filtered.length}</strong> gefiltert · {done}/{archetypes.length} mit Bild ({pct}%)</span>
          <span className="text-[#4ade80] font-bold">{done === archetypes.length ? "🎉 Alle fertig!" : `${archetypes.length - done} offen`}</span>
        </div>
        <div className="h-2 bg-[#0F1115] rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#22D1C3] to-[#FFD700] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {filtered.map((a) => (
          <ArchetypeCard key={a.id} archetype={a} onChange={onChange} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">Keine Wächter passen zu den Filtern.</div>
      )}
    </div>
  );
}

function ArchetypeCard({ archetype: a, onChange }: { archetype: Archetype; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prompt = buildArchetypePrompt({
    name: a.name,
    rarity: a.rarity as "elite" | "epic" | "legendary",
    guardianType: a.guardian_type,
    role: a.role,
    abilityName: a.ability_name,
    lore: a.lore,
  });

  const rarityMeta = RARITY_LABEL[a.rarity] ?? RARITY_LABEL.epic;
  const typeMeta = a.guardian_type ? TYPE_LABEL[a.guardian_type] : null;

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target_type", "archetype");
      form.append("target_id", a.id);
      const res = await fetch("/api/admin/artwork", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Upload fehlgeschlagen");
      } else onChange();
    } finally { setBusy(false); }
  };

  const removeImage = async () => {
    if (!confirm(`Bild für "${a.name}" wirklich löschen?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/artwork?target_type=archetype&target_id=${a.id}`, { method: "DELETE" });
      onChange();
    } finally { setBusy(false); }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const done = !!a.image_url;

  return (
    <div className={`rounded-xl overflow-hidden transition ${done ? "border-[#4ade80]/50" : "border-white/10"}`}
      style={{ background: "#1A1D23", border: `1px solid ${done ? "#4ade8055" : rarityMeta.color + "33"}` }}>
      {/* Image-Preview */}
      <div className="aspect-square bg-[#0F1115] flex items-center justify-center relative overflow-hidden">
        {a.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="text-7xl opacity-20">{a.emoji}</div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#FF2D78]/20 to-transparent text-center py-2 text-[10px] font-bold text-[#FF2D78] tracking-widest">
              KEIN BILD
            </div>
          </>
        )}
        {a.image_url && (
          <button onClick={removeImage} disabled={busy}
            className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg hover:bg-[#FF2D78]">
            × Löschen
          </button>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest"
          style={{ background: rarityMeta.color + "22", color: rarityMeta.color, border: `1px solid ${rarityMeta.color}` }}>
          {rarityMeta.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="font-black text-sm">{a.name}</div>
        <div className="text-[10px] text-[#8B8FA3] flex items-center gap-1 mt-1 flex-wrap">
          {typeMeta && (
            <span style={{ color: typeMeta.color }} className="font-bold">
              {typeMeta.icon} {typeMeta.label}
            </span>
          )}
          {a.role && <span>· {ROLE_LABEL[a.role]}</span>}
          <span className="opacity-60">· {a.id}</span>
        </div>
        {a.ability_name && (
          <div className="text-[10px] text-[#FFD700] mt-1 truncate" title={a.ability_name}>
            ⚡ {a.ability_name}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={copyPrompt}
            className="flex-1 text-[11px] bg-[#0F1115] border border-white/10 rounded-lg py-1.5 hover:bg-white/5 font-bold">
            {copied ? "✓ Kopiert" : "📋 Prompt"}
          </button>
          <label className={`flex-1 text-center text-[11px] rounded-lg py-1.5 cursor-pointer font-bold ${
            busy ? "bg-[#333] text-[#888]" : done ? "bg-[#4ade80] text-[#0F1115] hover:bg-[#22c55e]" : "bg-[#FF2D78] text-white hover:opacity-90"
          }`}>
            {busy ? "Lädt…" : done ? "🔄 Ersetzen" : "⬆️ Upload"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
            />
          </label>
        </div>

        {/* Prompt-Details (collapsed) */}
        <details className="mt-2">
          <summary className="text-[10px] text-[#8B8FA3] cursor-pointer hover:text-white">Prompt anzeigen</summary>
          <textarea readOnly value={prompt}
            className="w-full mt-1 bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[10px] text-[#DDD] font-mono h-32 resize-none" />
        </details>

        {err && <div className="text-[10px] text-[#FF2D78] mt-2">{err}</div>}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Item-Bilder (unchanged)                              */
/* ═════════════════════════════════════════════════════════ */
function ItemsTab({ items, races, onChange }: { items: Item[]; races: RaceLore[]; onChange: () => void }) {
  const raceMap = new Map(races.map((r) => [r.name, r]));
  const [filterSlot, setFilterSlot] = useState<string>("ALL");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterRace, setFilterRace] = useState<string>("ALL");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [limit, setLimit] = useState(120);

  const slots     = Array.from(new Set(items.map((i) => i.slot)));
  const rarities  = Array.from(new Set(items.map((i) => i.rarity)));
  const raceNames = Array.from(new Set(items.map((i) => i.race).filter((r): r is string => !!r))).sort();

  const filtered = items.filter((i) => {
    if (filterSlot !== "ALL" && i.slot !== filterSlot) return false;
    if (filterRarity !== "ALL" && i.rarity !== filterRarity) return false;
    if (filterRace === "UNIVERSAL") { if (i.race) return false; }
    else if (filterRace !== "ALL" && i.race !== filterRace) return false;
    if (showMissingOnly && i.image_url) return false;
    return true;
  });

  const withImage = items.filter(i => i.image_url).length;
  const pct = items.length > 0 ? Math.round((withImage / items.length) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterRace} onChange={(e) => { setFilterRace(e.target.value); setLimit(120); }}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rassen ({items.length})</option>
          <option value="UNIVERSAL">🌐 Universal ({items.filter(i => !i.race).length})</option>
          {raceNames.map((r) => {
            const c = items.filter(i => i.race === r).length;
            return <option key={r} value={r}>{r} ({c})</option>;
          })}
        </select>
        <select value={filterSlot} onChange={(e) => { setFilterSlot(e.target.value); setLimit(120); }}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Slots</option>
          {slots.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRarity} onChange={(e) => { setFilterRarity(e.target.value); setLimit(120); }}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rarities</option>
          {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#a8b4cf]">
          <input type="checkbox" checked={showMissingOnly} onChange={(e) => { setShowMissingOnly(e.target.checked); setLimit(120); }} />
          Nur ohne Bild
        </label>
        <div className="ml-auto text-xs text-[#8B8FA3] self-center">
          <strong className="text-white">{filtered.length}</strong> gefiltert · {withImage}/{items.length} ({pct}%) mit Bild
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {filtered.slice(0, limit).map((it) => (
          <ArtworkCard
            key={it.id}
            targetType="item"
            targetId={it.id}
            title={it.name}
            subtitle={[it.race ?? "Universal", it.slot, it.rarity, it.cosmetic_only ? "cosmetic" : ""].filter(Boolean).join(" · ")}
            emoji={it.emoji}
            imageUrl={it.image_url}
            prompt={(() => {
              const lore = it.race ? raceMap.get(it.race) : null;
              const material = lore?.material_desc || `${it.rarity} ${it.slot}`;
              const glow = lore?.energy_color || "#1db682";
              return `Game Icon, ${it.name}, material: ${material}, cinematic lighting, glow color ${glow}, 8k, black background, 3D render, Unreal Engine 5 style, accent colors #1db682 and #6991d8, centered, transparency-safe edges, no text, no logo.`;
            })()}
            onChange={onChange}
          />
        ))}
      </div>

      {filtered.length > limit && (
        <div className="text-center mt-6">
          <button
            onClick={() => setLimit(limit + 120)}
            className="px-6 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-sm font-bold hover:bg-[#1db682]"
          >
            Weitere 120 laden ({filtered.length - limit} übrig)
          </button>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Prompt-Generator (unchanged)                         */
/* ═════════════════════════════════════════════════════════ */
function PromptsTab({ items, onChange }: { items: Item[]; onChange: () => void }) {
  const [filterRace, setFilterRace] = useState<string>("ALL");
  const [filterSlot, setFilterSlot] = useState<ArtworkSlot | "ALL">("ALL");
  const [filterRarity, setFilterRarity] = useState<ArtworkRarity | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const allPrompts = useMemo<GeneratedPrompt[]>(() => {
    const out: GeneratedPrompt[] = [];
    for (const race of Object.keys(ARTWORK_RACES)) {
      for (const slot of ARTWORK_SLOTS) {
        for (const r of ARTWORK_RARITIES) {
          out.push(buildPrompt(race, slot, r.level));
        }
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    return allPrompts.filter((p) => {
      if (filterRace !== "ALL" && p.race !== filterRace) return false;
      if (filterSlot !== "ALL" && p.slot !== filterSlot) return false;
      if (filterRarity !== "ALL" && p.rarity !== filterRarity) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.itemName.toLowerCase().includes(q) && !p.race.toLowerCase().includes(q)) return false;
      }
      if (onlyMissing) {
        const m = findMatchingItem(items, p.race, p.slot, p.rarity);
        if (m?.image_url) return false;
      }
      return true;
    });
  }, [allPrompts, filterRace, filterSlot, filterRarity, search, onlyMissing, items]);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <select value={filterRace} onChange={(e) => setFilterRace(e.target.value)} className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rassen</option>
          {Object.keys(ARTWORK_RACES).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterSlot} onChange={(e) => setFilterSlot(e.target.value as ArtworkSlot)} className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Slots</option>
          {ARTWORK_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as ArtworkRarity)} className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rarities</option>
          {ARTWORK_RARITIES.map((r) => <option key={r.level} value={r.level}>{r.level}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche…"
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Nur offen
        </label>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
        {filtered.slice(0, 200).map((p) => (
          <PromptCard key={p.key} prompt={p} matchingItem={findMatchingItem(items, p.race, p.slot, p.rarity)} onChange={onChange} />
        ))}
      </div>
      {filtered.length > 200 && (
        <div className="text-center text-xs text-[#8B8FA3] mt-4">
          Zeige erste 200 — für komplette Liste CSV exportieren.
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt, matchingItem, onChange }: {
  prompt: GeneratedPrompt;
  matchingItem: Item | null;
  onChange: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const upload = async (file: File) => {
    if (!matchingItem) return;
    setUploading(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target_type", "item");
      form.append("target_id", matchingItem.id);
      const res = await fetch("/api/admin/artwork", { method: "POST", body: form });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || "Upload fehlgeschlagen"); }
      else onChange();
    } finally { setUploading(false); }
  };

  const done = !!matchingItem?.image_url;
  const noMatch = !matchingItem;

  return (
    <div
      className={`rounded-xl p-3 border transition ${done ? "bg-[#0d2015]" : "bg-[#1A1D23]"}`}
      style={{ borderColor: done ? "#4ade80" : prompt.accentColor + "55" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: prompt.accentColor + "22", color: prompt.accentColor, border: `1px solid ${prompt.accentColor}` }}>
          {prompt.rarity}
        </span>
        <span className="text-[10px] text-[#8B8FA3]">{prompt.role} · {prompt.slot}</span>
        {done && <span className="text-[10px] text-[#4ade80] font-black ml-auto">✓ ERLEDIGT</span>}
        {!done && <span className="text-[10px] text-[#8B8FA3] ml-auto">Stat +{prompt.statValue}</span>}
      </div>
      <div className="font-bold text-sm mb-1">{prompt.itemName}</div>
      {matchingItem && (
        <div className="text-[10px] text-[#8B8FA3] mb-2 truncate" title={matchingItem.name}>
          → DB: {matchingItem.name}
        </div>
      )}

      {done && matchingItem?.image_url && (
        <div className="mb-2 aspect-square bg-[#0F1115] rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={matchingItem.image_url} alt={matchingItem.name} className="w-full h-full object-cover" />
        </div>
      )}

      <textarea
        readOnly value={prompt.prompt}
        className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[11px] text-[#DDD] font-mono h-20 resize-none"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={copy} className="flex-1 text-xs font-bold bg-[#22D1C3] text-[#0F1115] rounded-lg py-1.5 hover:bg-[#1db682]">
          {copied ? "✓ Kopiert" : "📋 Prompt"}
        </button>
        {noMatch ? (
          <span className="flex-1 text-[10px] text-[#8B8FA3] py-1.5 text-center bg-[#0F1115] rounded-lg border border-white/10">
            Kein DB-Item
          </span>
        ) : (
          <label className={`flex-1 text-xs text-center rounded-lg py-1.5 cursor-pointer font-bold ${
            uploading ? "bg-[#333] text-[#888]" : done ? "bg-[#4ade80] text-[#0F1115] hover:bg-[#22c55e]" : "bg-[#FF2D78] text-white hover:opacity-90"
          }`}>
            {uploading ? "Lädt…" : done ? "🔄 Ersetzen" : "⬆️ Bild hoch"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>
      {err && <div className="text-[10px] text-[#FF2D78] mt-1">{err}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Shared Card (Items)                                       */
/* ═════════════════════════════════════════════════════════ */
function ArtworkCard({ targetType, targetId, title, subtitle, emoji, imageUrl, prompt, onChange }: {
  targetType: "archetype" | "item";
  targetId: string;
  title: string;
  subtitle: string;
  emoji: string;
  imageUrl: string | null;
  prompt: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target_type", targetType);
      form.append("target_id", targetId);
      const res = await fetch("/api/admin/artwork", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Upload fehlgeschlagen");
      } else onChange();
    } finally { setBusy(false); }
  };

  const removeImage = async () => {
    if (!confirm(`Bild für "${title}" wirklich löschen?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/artwork?target_type=${targetType}&target_id=${targetId}`, { method: "DELETE" });
      onChange();
    } finally { setBusy(false); }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl bg-[#1A1D23] border border-white/10 overflow-hidden">
      <div className="aspect-square bg-[#0F1115] flex items-center justify-center text-7xl relative">
        {imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          : <span className="opacity-30">{emoji}</span>
        }
        {imageUrl && (
          <button onClick={removeImage} disabled={busy}
            className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg hover:bg-[#FF2D78]">
            × Löschen
          </button>
        )}
      </div>
      <div className="p-3">
        <div className="font-bold text-sm truncate">{title}</div>
        <div className="text-[11px] text-[#8B8FA3] mb-3">{subtitle}</div>

        <button onClick={copyPrompt}
          className="w-full text-[11px] bg-[#0F1115] border border-white/10 rounded-lg py-1.5 mb-2 hover:bg-white/5">
          {copied ? "✓ Prompt kopiert" : "📋 KI-Prompt kopieren"}
        </button>

        <label className={`block w-full text-center text-[11px] rounded-lg py-1.5 cursor-pointer font-bold ${
          busy ? "bg-[#333] text-[#888]" : "bg-[#22D1C3] text-[#0F1115] hover:bg-[#1db682]"
        }`}>
          {busy ? "Lädt…" : (imageUrl ? "🔄 Neu hochladen" : "⬆️ Bild hochladen")}
          <input
            type="file" accept="image/png,image/jpeg,image/webp"
            className="hidden" disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>

        {err && <div className="text-[10px] text-[#FF2D78] mt-2">{err}</div>}
      </div>
    </div>
  );
}

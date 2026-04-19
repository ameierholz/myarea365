"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ARTWORK_RACES, ARTWORK_SLOTS, ARTWORK_RARITIES,
  buildPrompt, buildArchetypePrompt,
  type ArtworkSlot, type ArtworkRarity, type GeneratedPrompt,
} from "@/lib/artwork-prompts";

type Archetype = { id: string; name: string; emoji: string; rarity: string; image_url: string | null };
type Item      = { id: string; name: string; emoji: string; slot: string; rarity: string; image_url: string | null; cosmetic_only: boolean };

type Tab = "prompts" | "archetypes" | "items";

export function ArtworkAdminClient() {
  const [tab, setTab] = useState<Tab>("prompts");
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/artwork", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setArchetypes(data.archetypes);
      setItems(data.items);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">🎨 Artwork-Generator</h1>
      <p className="text-sm text-[#a8b4cf] mb-4">
        Generiere KI-Prompts für Scenario.gg / Canova Pro und lade die fertigen Bilder direkt zu den passenden Wächtern und Items hoch.
      </p>

      <div className="flex gap-2 mb-6">
        {([
          { id: "prompts",    label: "🎲 Prompt-Generator (1800)" },
          { id: "archetypes", label: "🛡️ Wächter-Bilder" },
          { id: "items",      label: "⚔️ Item-Bilder" },
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

      {tab === "prompts" && <PromptsTab />}
      {tab === "archetypes" && (loading ? <LoadingBox /> : <ArchetypesTab archetypes={archetypes} onChange={reload} />)}
      {tab === "items" && (loading ? <LoadingBox /> : <ItemsTab items={items} onChange={reload} />)}
    </div>
  );
}

function LoadingBox() {
  return <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>;
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab 1: Prompt-Generator                                   */
/* ═════════════════════════════════════════════════════════ */
function PromptsTab() {
  const [filterRace, setFilterRace] = useState<string>("ALL");
  const [filterSlot, setFilterSlot] = useState<ArtworkSlot | "ALL">("ALL");
  const [filterRarity, setFilterRarity] = useState<ArtworkRarity | "ALL">("ALL");
  const [search, setSearch] = useState("");

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
      return true;
    });
  }, [allPrompts, filterRace, filterSlot, filterRarity, search]);

  const exportCsv = () => {
    const header = "key,itemName,race,role,slot,rarity,statValue,prompt";
    const rows = filtered.map((p) =>
      [p.key, p.itemName, p.race, p.role, p.slot, p.rarity, p.statValue,
       `"${p.prompt.replace(/"/g, '""')}"`].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `artwork-prompts-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

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
        <button onClick={exportCsv} className="bg-[#22D1C3] text-[#0F1115] rounded-lg px-3 py-2 text-sm font-bold">
          ⬇️ CSV ({filtered.length})
        </button>
      </div>

      <div className="text-xs text-[#8B8FA3] mb-3">
        <strong className="text-white">{filtered.length}</strong> von {allPrompts.length} Prompts · Brand-Farben #1db682 &amp; #6991d8 automatisch eingewoben
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
        {filtered.slice(0, 200).map((p) => <PromptCard key={p.key} prompt={p} />)}
      </div>
      {filtered.length > 200 && (
        <div className="text-center text-xs text-[#8B8FA3] mt-4">
          Zeige erste 200 — für komplette Liste CSV exportieren.
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt }: { prompt: GeneratedPrompt }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl p-3 bg-[#1A1D23] border" style={{ borderColor: prompt.accentColor + "55" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: prompt.accentColor + "22", color: prompt.accentColor, border: `1px solid ${prompt.accentColor}` }}>
          {prompt.rarity}
        </span>
        <span className="text-[10px] text-[#8B8FA3]">{prompt.role} · {prompt.slot}</span>
        <span className="text-[10px] text-[#8B8FA3] ml-auto">Stat +{prompt.statValue}</span>
      </div>
      <div className="font-bold text-sm mb-2">{prompt.itemName}</div>
      <textarea
        readOnly value={prompt.prompt}
        className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[11px] text-[#DDD] font-mono h-24 resize-none"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={copy} className="flex-1 text-xs font-bold bg-[#22D1C3] text-[#0F1115] rounded-lg py-1.5">
          {copied ? "✓ Kopiert" : "📋 Prompt kopieren"}
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab 2: Wächter-Bilder (Archetypes)                         */
/* ═════════════════════════════════════════════════════════ */
function ArchetypesTab({ archetypes, onChange }: { archetypes: Archetype[]; onChange: () => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {archetypes.map((a) => (
        <ArtworkCard
          key={a.id}
          targetType="archetype"
          targetId={a.id}
          title={a.name}
          subtitle={a.rarity}
          emoji={a.emoji}
          imageUrl={a.image_url}
          prompt={buildArchetypePrompt(a.name, a.rarity as "common" | "rare" | "epic" | "legend")}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab 3: Item-Bilder                                         */
/* ═════════════════════════════════════════════════════════ */
function ItemsTab({ items, onChange }: { items: Item[]; onChange: () => void }) {
  const [filterSlot, setFilterSlot] = useState<string>("ALL");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const slots = Array.from(new Set(items.map((i) => i.slot)));
  const rarities = Array.from(new Set(items.map((i) => i.rarity)));

  const filtered = items.filter((i) => {
    if (filterSlot !== "ALL" && i.slot !== filterSlot) return false;
    if (filterRarity !== "ALL" && i.rarity !== filterRarity) return false;
    if (showMissingOnly && i.image_url) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)} className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Slots</option>
          {slots.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rarities</option>
          {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#a8b4cf]">
          <input type="checkbox" checked={showMissingOnly} onChange={(e) => setShowMissingOnly(e.target.checked)} />
          Nur ohne Bild
        </label>
        <div className="ml-auto text-xs text-[#8B8FA3] self-center">
          {filtered.length} / {items.length} Items · {items.filter(i => i.image_url).length} mit Bild
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {filtered.map((it) => (
          <ArtworkCard
            key={it.id}
            targetType="item"
            targetId={it.id}
            title={it.name}
            subtitle={`${it.slot} · ${it.rarity}${it.cosmetic_only ? " · cosmetic" : ""}`}
            emoji={it.emoji}
            imageUrl={it.image_url}
            prompt={`Game Icon, ${it.rarity} ${it.slot} '${it.name}', detailed 3D render, dark background, accent colors #1db682 and #6991d8, Unreal Engine 5 style, 8k, centered, transparency-safe edges, no text.`}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Shared Card (Upload + Prompt + Preview)                    */
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
      } else {
        onChange();
      }
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

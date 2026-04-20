"use client";

import { useMemo, useState, useEffect } from "react";
import { buildArchetypePrompt } from "@/lib/artwork-prompts";

type Archetype = {
  id: string; name: string; emoji: string; rarity: string; image_url: string | null; video_url: string | null;
  guardian_type: "infantry" | "cavalry" | "marksman" | "mage" | null;
  role: "dps" | "tank" | "support" | "balanced" | null;
  ability_name: string | null; lore: string | null;
};

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

export function ArtworkAdminClient() {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/artwork", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setArchetypes(data.archetypes);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const done = archetypes.filter(a => a.image_url || a.video_url).length;

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">🎨 Artwork-Generator</h1>
      <p className="text-sm text-[#a8b4cf] mb-4">
        Generiere KI-Prompts (Bild & Video) für Gemini Pro / Veo 2 / Midjourney und lade die fertigen Assets direkt zu den 60 Wächtern hoch.
        <span className="ml-2 px-2 py-0.5 rounded-full bg-[#22D1C3]/15 text-[#22D1C3] text-xs font-bold">
          {done} / {archetypes.length}
        </span>
      </p>

      {loading ? <LoadingBox /> : <ArchetypesTab archetypes={archetypes} onChange={reload} />}
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
  const [copiedKind, setCopiedKind] = useState<"image" | "video" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const promptInputBase = {
    name: a.name,
    rarity: a.rarity as "elite" | "epic" | "legendary",
    guardianType: a.guardian_type,
    role: a.role,
    abilityName: a.ability_name,
    lore: a.lore,
  };
  const promptImage = buildArchetypePrompt({ ...promptInputBase, mode: "image" });
  const promptVideo = buildArchetypePrompt({ ...promptInputBase, mode: "video" });

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

  async function copyPrompt(kind: "image" | "video") {
    await navigator.clipboard.writeText(kind === "video" ? promptVideo : promptImage);
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind(null), 1500);
  }

  const hasImage = !!a.image_url;
  const hasVideo = !!a.video_url;
  const done = hasImage || hasVideo;

  return (
    <div className={`rounded-xl overflow-hidden transition ${done ? "border-[#4ade80]/50" : "border-white/10"}`}
      style={{ background: "#1A1D23", border: `1px solid ${done ? "#4ade8055" : rarityMeta.color + "33"}` }}>
      {/* Preview: Video > Image > Fallback */}
      <div className="aspect-square bg-[#0F1115] flex items-center justify-center relative overflow-hidden">
        {hasVideo ? (
          <video src={a.video_url!} poster={a.image_url ?? undefined}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover" />
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url!} alt={a.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="text-7xl opacity-20">{a.emoji}</div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#FF2D78]/20 to-transparent text-center py-2 text-[10px] font-bold text-[#FF2D78] tracking-widest">
              KEIN ARTWORK
            </div>
          </>
        )}
        {hasVideo && (
          <div className="absolute top-2 left-2 bg-[#FF2D78]/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest">🎬 VIDEO</div>
        )}
        {done && (
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

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => copyPrompt("image")}
            className={`text-[11px] rounded-lg py-1.5 font-bold relative ${
              hasImage
                ? "bg-[#4ade80]/15 border border-[#4ade80]/50 text-[#4ade80] hover:bg-[#4ade80]/25"
                : "bg-[#0F1115] border border-[#22D1C3]/40 text-[#22D1C3] hover:bg-[#22D1C3]/10"
            }`}>
            {copiedKind === "image"
              ? "✓ Prompt kopiert"
              : hasImage ? "✅ Bild ok · 📋" : "📋 Bild-Prompt"}
          </button>
          <button onClick={() => copyPrompt("video")}
            className={`text-[11px] rounded-lg py-1.5 font-bold relative ${
              hasVideo
                ? "bg-[#4ade80]/15 border border-[#4ade80]/50 text-[#4ade80] hover:bg-[#4ade80]/25"
                : "bg-[#0F1115] border border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10"
            }`}>
            {copiedKind === "video"
              ? "✓ Prompt kopiert"
              : hasVideo ? "✅ Video ok · 📋" : "🎬 Video-Prompt"}
          </button>
        </div>

        <label className={`mt-2 block w-full text-center text-[11px] rounded-lg py-1.5 cursor-pointer font-bold ${
          busy ? "bg-[#333] text-[#888]" : done ? "bg-[#4ade80] text-[#0F1115] hover:bg-[#22c55e]" : "bg-gradient-to-r from-[#FF2D78] to-[#a855f7] text-white hover:opacity-90"
        }`}>
          {busy ? "Lädt…" : done ? "🔄 Bild/Video ersetzen" : "⬆️ Bild oder MP4 hochladen"}
          <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </label>

        {/* Prompts (collapsed) */}
        <details className="mt-2">
          <summary className="text-[10px] text-[#8B8FA3] cursor-pointer hover:text-white">Prompts anzeigen</summary>
          <div className="text-[9px] text-[#22D1C3] font-bold mt-1">BILD</div>
          <textarea readOnly value={promptImage}
            className="w-full mt-1 bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[10px] text-[#DDD] font-mono h-24 resize-none" />
          <div className="text-[9px] text-[#FF2D78] font-bold mt-2">🎬 VIDEO (Canva Magic Animate / Runway / Pika)</div>
          <textarea readOnly value={promptVideo}
            className="w-full mt-1 bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[10px] text-[#DDD] font-mono h-28 resize-none" />
        </details>

        {err && <div className="text-[10px] text-[#FF2D78] mt-2">{err}</div>}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import { buildArchetypePrompt, buildPrompt, buildMarkerPrompt, buildLightPrompt, buildPinThemePrompt, buildSiegelPrompt, SIEGEL_TYPES, buildPotionPrompt, POTION_CATALOG_ART, buildRankPrompt, RANK_TIERS_ART, buildMaterialPrompt } from "@/lib/artwork-prompts";
import { uploadArtworkDirect } from "@/lib/artwork-upload";
import { UNLOCKABLE_MARKERS, RUNNER_LIGHTS, GENDERED_MARKER_IDS, MARKER_VARIANT_LABEL } from "@/lib/game-config";
import { PIN_THEME_META, ALL_PIN_THEMES } from "@/lib/pin-themes";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";

type Archetype = {
  id: string; name: string; emoji: string; rarity: string; image_url: string | null; video_url: string | null;
  guardian_type: "infantry" | "cavalry" | "marksman" | "mage" | null;
  class_id: "tank" | "support" | "ranged" | "melee" | null;
  role: "dps" | "tank" | "support" | "balanced" | null;
  species: string | null;
  gender: "male" | "female" | "neutral" | null;
  ability_name: string | null; lore: string | null;
};

const RARITY_LABEL: Record<string, { label: string; color: string }> = {
  common:    { label: "GEWÖHNLICH", color: "#9aa3b8" },
  elite:     { label: "ELITE",      color: "#22D1C3" },
  epic:      { label: "EPISCH",     color: "#a855f7" },
  legendary: { label: "LEGENDÄR",   color: "#FFD700" },
  // Legacy-Fallback (vor 5x4-Rework)
  rare:      { label: "ELITE",      color: "#22D1C3" },
  legend:    { label: "LEGENDÄR",   color: "#FFD700" },
};

const TYPE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};

// Neue 4-Klassen-Anzeige (tank/support/ranged/melee).
const CLASS_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  tank:    { label: "Tank",      icon: "🛡️", color: "#60a5fa" },
  support: { label: "Support",   icon: "✨", color: "#a855f7" },
  ranged:  { label: "Fernkampf", icon: "🏹", color: "#4ade80" },
  melee:   { label: "Nahkampf",  icon: "⚔️", color: "#FF6B4A" },
};

// Sub-Rollen aus Migration 00073 (4 pro Klasse). Plus Legacy-Werte (dps/tank/support/balanced).
const ROLE_LABEL: Record<string, { label: string; icon: string }> = {
  // Tank
  krieger:        { label: "Krieger",        icon: "🛡️" },
  ritter:         { label: "Ritter",         icon: "🛡️" },
  paladin:        { label: "Paladin",        icon: "🛡️" },
  berserker:      { label: "Berserker",      icon: "🛡️" },
  // Support
  priester:       { label: "Priester",       icon: "✨" },
  schamane:       { label: "Schamane",       icon: "✨" },
  kleriker:       { label: "Kleriker",       icon: "✨" },
  orakel:         { label: "Orakel",         icon: "✨" },
  // Ranged
  magier:         { label: "Magier",         icon: "🏹" },
  bogenschuetze:  { label: "Bogenschütze",   icon: "🏹" },
  hexer:          { label: "Hexer",          icon: "🏹" },
  runenmeister:   { label: "Runenmeister",   icon: "🏹" },
  // Melee
  schurke:        { label: "Schurke",        icon: "⚔️" },
  moench:         { label: "Mönch",          icon: "⚔️" },
  samurai:        { label: "Samurai",        icon: "⚔️" },
  ninja:          { label: "Ninja",          icon: "⚔️" },
  // Legacy fallback
  dps:            { label: "DPS",            icon: "·" },
  tank:           { label: "Tank",           icon: "·" },
  support:        { label: "Support",        icon: "·" },
  balanced:       { label: "Balanced",       icon: "·" },
};

type Art = { image_url: string | null; video_url: string | null };
type CosmeticArt = {
  marker:    Record<string, Record<string, Art>>; // marker[id][variant]
  light:     Record<string, Art>;
  pin_theme: Record<string, Art>;
  siegel:    Record<string, Art>;
  potion:    Record<string, Art>;
  rank:      Record<string, Art>;
};

type TabId = "archetype" | "item" | "material" | "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank";

type Item = {
  id: string; name: string; emoji: string; slot: string; rarity: string;
  class_id: "tank" | "support" | "ranged" | "melee" | null;
  image_url: string | null;
};

type Material = {
  id: string; name: string; emoji: string; description: string | null; tier: number; sort: number;
  image_url: string | null; video_url: string | null;
};

export function ArtworkAdminClient() {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [cosmetic, setCosmetic] = useState<CosmeticArt>({ marker: {}, light: {}, pin_theme: {}, siegel: {}, potion: {}, rank: {} });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("archetype");

  const reload = async () => {
    setLoading(true);
    const [aw, co] = await Promise.all([
      fetch("/api/admin/artwork", { cache: "no-store" }),
      fetch("/api/cosmetic-artwork", { cache: "no-store" }),
    ]);
    // Cache-Buster — gleicher Storage-Pfad beim Re-Upload, sonst zeigt Browser cached asset
    const v = Date.now();
    const bust = (u: string | null) => (u ? `${u}?v=${v}` : null);
    if (aw.ok) {
      const j = await aw.json();
      type RawArch = { image_url: string | null; video_url: string | null; [k: string]: unknown };
      type RawItem = { image_url: string | null; [k: string]: unknown };
      type RawMat  = { image_url: string | null; video_url: string | null; [k: string]: unknown };
      setArchetypes((j.archetypes as RawArch[]).map((a) => ({ ...a, image_url: bust(a.image_url), video_url: bust(a.video_url) })) as Archetype[]);
      setItems(((j.items ?? []) as RawItem[]).map((i) => ({ ...i, image_url: bust(i.image_url) })) as Item[]);
      setMaterials(((j.materials ?? []) as RawMat[]).map((m) => ({ ...m, image_url: bust(m.image_url), video_url: bust(m.video_url) })) as Material[]);
    }
    if (co.ok) {
      const raw = await co.json() as CosmeticArt;
      type RawArt = { image_url: string | null; video_url: string | null };
      const bustMap = (obj: Record<string, RawArt>) => Object.fromEntries(Object.entries(obj).map(([k, a]) => [k, { image_url: bust(a.image_url), video_url: bust(a.video_url) }]));
      const bustMarker = (obj: Record<string, Record<string, RawArt>>) => Object.fromEntries(Object.entries(obj).map(([k, variants]) => [k, bustMap(variants)]));
      setCosmetic({
        marker:    bustMarker(raw.marker    ?? {}),
        light:     bustMap(raw.light     ?? {}),
        pin_theme: bustMap(raw.pin_theme ?? {}),
        siegel:    bustMap(raw.siegel    ?? {}),
        potion:    bustMap(raw.potion    ?? {}),
        rank:      bustMap(raw.rank      ?? {}),
      });
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const doneArch   = archetypes.filter(a => a.image_url || a.video_url).length;
  const doneItems  = items.filter(i => i.image_url).length;
  const doneMat    = materials.filter(m => m.image_url || m.video_url).length;
  const doneMark   = Object.values(cosmetic.marker).reduce((acc, variants) => acc + Object.values(variants).filter(a => a.image_url || a.video_url).length, 0);
  const doneLight  = Object.values(cosmetic.light).filter(a => a.image_url || a.video_url).length;
  const doneTheme  = Object.values(cosmetic.pin_theme).filter(a => a.image_url || a.video_url).length;
  const doneSiegel = Object.values(cosmetic.siegel ?? {}).filter(a => a.image_url || a.video_url).length;
  const donePotion = Object.values(cosmetic.potion ?? {}).filter(a => a.image_url || a.video_url).length;
  const doneRank   = Object.values(cosmetic.rank ?? {}).filter(a => a.image_url || a.video_url).length;

  const tabs: Array<{ id: TabId; label: string; done: number; total: number }> = [
    { id: "archetype", label: "🛡️ Wächter",        done: doneArch,   total: archetypes.length },
    { id: "item",      label: "⚔️ Ausrüstung",     done: doneItems,  total: items.length },
    { id: "material",  label: "🧱 Materialien",    done: doneMat,    total: materials.length },
    { id: "siegel",    label: "🏅 Siegel",          done: doneSiegel, total: SIEGEL_TYPES.length },
    { id: "potion",    label: "🧪 Tränke",          done: donePotion, total: POTION_CATALOG_ART.length },
    { id: "rank",      label: "🎖️ Ränge",           done: doneRank,   total: RANK_TIERS_ART.length },
    { id: "marker",    label: "📍 Map-Icons",       done: doneMark,   total: UNLOCKABLE_MARKERS.length },
    { id: "light",     label: "✨ Runner-Lights",   done: doneLight,  total: RUNNER_LIGHTS.length },
    { id: "pin_theme", label: "🎨 Pin-Themes",      done: doneTheme,  total: ALL_PIN_THEMES.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">🎨 Artwork-Generator</h1>
      <p className="text-sm text-[#a8b4cf] mb-3">
        KI-Prompts (Bild & Video) für Gemini Pro / Veo 2 / Midjourney generieren und die fertigen Assets direkt hochladen — für Wächter, Map-Icons, Runner-Lights und Pin-Themes.
      </p>

      {/* Tab-Switcher */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-white/10 pb-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                active
                  ? "bg-[#22D1C3] text-[#0F1115]"
                  : "bg-[#1A1D23] border border-white/10 text-[#a8b4cf] hover:text-white"
              }`}>
              {t.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${active ? "bg-[#0F1115]/20" : "bg-[#22D1C3]/15 text-[#22D1C3]"}`}>
                {t.done}/{t.total}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? <LoadingBox /> : (
        tab === "archetype"  ? <ArchetypesTab archetypes={archetypes} onChange={reload} />
        : tab === "item"      ? <ItemsTab     items={items}              onChange={reload} />
        : tab === "material"  ? <MaterialTab  materials={materials}      onChange={reload} />
        : tab === "siegel"    ? <SiegelTab    artMap={cosmetic.siegel ?? {}} onChange={reload} />
        : tab === "potion"    ? <PotionTab    artMap={cosmetic.potion ?? {}} onChange={reload} />
        : tab === "rank"      ? <RankTab      artMap={cosmetic.rank   ?? {}} onChange={reload} />
        : tab === "marker"    ? <MarkerTab    artMap={cosmetic.marker}    onChange={reload} />
        : tab === "light"     ? <LightTab     artMap={cosmetic.light}     onChange={reload} />
        : <PinThemeTab artMap={cosmetic.pin_theme} onChange={reload} />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Map-Icons / Runner-Lights / Pin-Themes               */
/* ═════════════════════════════════════════════════════════ */

function MarkerTab({ artMap, onChange }: { artMap: Record<string, Record<string, { image_url: string | null; video_url: string | null }>>; onChange: () => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {UNLOCKABLE_MARKERS.map((m) => {
        const isGendered = (GENDERED_MARKER_IDS as readonly string[]).includes(m.id);
        const variants: Array<"neutral" | "male" | "female"> = isGendered ? ["male","female"] : ["neutral"];
        const headArt = (artMap[m.id]?.male) ?? (artMap[m.id]?.female) ?? (artMap[m.id]?.neutral);
        return (
          <div key={m.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-[#0F1115] text-3xl">
                {headArt?.video_url ? <video src={headArt.video_url} autoPlay loop muted playsInline className="w-16 h-16 object-contain" />
                  : headArt?.image_url ? <img src={headArt.image_url} alt={m.name} className="w-16 h-16 object-contain" />
                  : <span>{m.icon}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#8B8FA3] tracking-wider">MAP-ICON{isGendered ? " · Varianten" : ""}</div>
                <div className="text-sm font-black text-white truncate">{m.name}</div>
                <div className="text-[10px] text-[#a8b4cf]">{m.cost >= 1000 ? `${m.cost/1000}k` : m.cost} XP</div>
              </div>
            </div>
            {variants.map((v) => {
              const vArt = artMap[m.id]?.[v];
              return (
                <div key={v} className="mb-2 pb-2 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
                  {isGendered && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-10 h-10 flex items-center justify-center rounded bg-[#0F1115]">
                        {vArt?.video_url ? <video src={vArt.video_url} autoPlay loop muted playsInline className="w-10 h-10 object-contain" />
                          : vArt?.image_url ? <img src={vArt.image_url} alt="" className="w-10 h-10 object-contain" />
                          : <span className="text-xl">{m.icon}</span>}
                      </div>
                      <div className="text-[11px] font-bold text-white flex-1">{MARKER_VARIANT_LABEL[v]}</div>
                      {!(vArt?.image_url || vArt?.video_url) && <span className="text-[9px] font-bold text-[#FF2D78]">LEER</span>}
                    </div>
                  )}
                  <AdminArtworkControls
                    targetType="marker"
                    targetId={m.id}
                    variant={v}
                    hasImage={!!vArt?.image_url}
                    hasVideo={!!vArt?.video_url}
                    buildPrompt={(mode) => buildMarkerPrompt({ id: m.id, name: m.name, hint: m.icon, mode, gender: v })}
                    onUploaded={onChange}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function LightTab({ artMap, onChange }: { artMap: Record<string, { image_url: string | null; video_url: string | null }>; onChange: () => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {RUNNER_LIGHTS.map((l) => {
        const art = artMap[l.id];
        const grad = l.gradient.length > 1 ? `linear-gradient(90deg, ${l.gradient.join(", ")})` : l.color;
        return (
          <div key={l.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-20 h-12 flex items-center justify-center rounded-lg bg-[#0F1115]">
                {art?.video_url ? <video src={art.video_url} autoPlay loop muted playsInline className="w-20 h-12 object-contain" />
                  : art?.image_url ? <img src={art.image_url} alt={l.name} className="w-20 h-12 object-contain" />
                  : <div style={{ width: 64, height: l.width, borderRadius: l.width/2, background: grad, boxShadow: `0 0 10px ${l.color}80` }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#8B8FA3] tracking-wider">RUNNER-LIGHT</div>
                <div className="text-sm font-black text-white truncate">{l.name}</div>
                <div className="text-[10px] text-[#a8b4cf]">{l.cost >= 1000 ? `${l.cost/1000}k` : l.cost} XP</div>
              </div>
            </div>
            <AdminArtworkControls
              targetType="light"
              targetId={l.id}
              hasImage={!!art?.image_url}
              hasVideo={!!art?.video_url}
              buildPrompt={(mode) => buildLightPrompt({ name: l.name, colors: [...l.gradient], mode })}
              onUploaded={onChange}
            />
          </div>
        );
      })}
    </div>
  );
}

function PinThemeTab({ artMap, onChange }: { artMap: Record<string, { image_url: string | null; video_url: string | null }>; onChange: () => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {ALL_PIN_THEMES.map((id) => {
        const m = PIN_THEME_META[id];
        const art = artMap[id];
        return (
          <div key={id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center rounded-lg" style={{
                width: 64, height: 64, background: m.preview.bg,
                border: `2px solid ${m.preview.accent}`, boxShadow: `0 0 12px ${m.preview.glow}`,
              }}>
                {art?.video_url ? <video src={art.video_url} autoPlay loop muted playsInline className="w-16 h-16 object-contain" />
                  : art?.image_url ? <img src={art.image_url} alt={m.name} className="w-16 h-16 object-contain" />
                  : <span style={{ fontSize: 28 }}>{m.icon}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#8B8FA3] tracking-wider">PIN-THEME</div>
                <div className="text-sm font-black text-white truncate">{m.name}</div>
                <div className="text-[10px] text-[#a8b4cf] truncate">{m.description}</div>
              </div>
            </div>
            <AdminArtworkControls
              targetType="pin_theme"
              targetId={id}
              hasImage={!!art?.image_url}
              hasVideo={!!art?.video_url}
              buildPrompt={(mode) => buildPinThemePrompt({
                name: m.name, description: m.description,
                bg: m.preview.bg, accent: m.preview.accent, glow: m.preview.glow, mode,
              })}
              onUploaded={onChange}
            />
          </div>
        );
      })}
    </div>
  );
}

function LoadingBox() {
  return <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>;
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Ausrüstung (Items)                                   */
/* ═════════════════════════════════════════════════════════ */

const SLOT_LABEL: Record<string, string> = {
  helm: "Helm", chest: "Brustplatte", legs: "Hose", boots: "Stiefel",
  gloves: "Handschuhe", weapon: "Waffe", necklace: "Halskette", ring: "Ring",
  // Legacy
  armor: "Rüstung", amulet: "Amulett",
};
const SLOT_EMOJI: Record<string, string> = {
  helm: "🪖", chest: "🛡️", legs: "👖", boots: "🥾",
  gloves: "🧤", weapon: "⚔️", necklace: "📿", ring: "💍",
  armor: "🛡️", amulet: "📿",
};
const ITEM_RARITY_META: Record<string, { label: string; color: string }> = {
  common: { label: "GEWÖHNLICH", color: "#8B8FA3" },
  rare:   { label: "SELTEN",     color: "#22D1C3" },
  epic:   { label: "EPISCH",     color: "#a855f7" },
  legend: { label: "LEGENDÄR",   color: "#FFD700" },
};

function ItemsTab({ items, onChange }: { items: Item[]; onChange: () => void }) {
  const [filterSlot, setFilterSlot] = useState<string>("ALL");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [missingOnly, setMissingOnly] = useState(false);

  const filtered = items.filter((i) => {
    if (filterSlot !== "ALL" && i.slot !== filterSlot) return false;
    if (filterRarity !== "ALL" && i.rarity !== filterRarity) return false;
    if (filterClass !== "ALL" && i.class_id !== filterClass) return false;
    if (missingOnly && i.image_url) return false;
    return true;
  });

  const done = items.filter(i => i.image_url).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  return (
    <div>
      {/* Filter-Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <select value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Slots</option>
          <option value="helm">🪖 Helm</option>
          <option value="chest">🛡️ Brustplatte</option>
          <option value="legs">👖 Hose</option>
          <option value="boots">🥾 Stiefel</option>
          <option value="gloves">🧤 Handschuhe</option>
          <option value="weapon">⚔️ Waffe</option>
          <option value="necklace">📿 Halskette</option>
          <option value="ring">💍 Ring</option>
        </select>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Klassen</option>
          <option value="tank">🛡️ Tank</option>
          <option value="support">✨ Support</option>
          <option value="ranged">🏹 Fernkampf</option>
          <option value="melee">⚔️ Nahkampf</option>
        </select>
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Raritäten</option>
          <option value="common">Gewöhnlich</option>
          <option value="rare">Selten</option>
          <option value="epic">Episch</option>
          <option value="legend">Legendär</option>
        </select>
        <label className="flex items-center gap-2 bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Nur ohne Bild
        </label>
      </div>

      {/* Progress */}
      <div className="mb-4 p-3 rounded-xl bg-[#1A1D23] border border-white/10">
        <div className="flex items-center justify-between mb-2 text-xs text-[#a8b4cf]">
          <span><strong className="text-white">{filtered.length}</strong> gefiltert · {done}/{items.length} mit Bild ({pct}%)</span>
          <span className="text-[#4ade80] font-bold">{done === items.length ? "🎉 Alle fertig!" : `${items.length - done} offen`}</span>
        </div>
        <div className="h-2 bg-[#0F1115] rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#22D1C3] to-[#FFD700] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} onChange={onChange} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">Keine Items passen zu den Filtern.</div>
      )}
    </div>
  );
}

function ItemCard({ item, onChange }: { item: Item; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rarity = ITEM_RARITY_META[item.rarity] ?? ITEM_RARITY_META.common;
  const hasImage = !!item.image_url;

  const prompt = buildItemPrompt(item);

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const result = await uploadArtworkDirect(file, "item", item.id);
      if (!result.ok) setErr(result.error);
      else onChange();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Bild für "${item.name}" löschen?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/artwork?target_type=item&target_id=${item.id}`, { method: "DELETE" });
      onChange();
    } finally { setBusy(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#1A1D23", border: `1px solid ${rarity.color}44` }}>
      <div className="aspect-square bg-[#0F1115] flex items-center justify-center relative">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url!} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="text-7xl opacity-20">{item.emoji}</div>
            <div className="absolute inset-x-0 bottom-0 py-1.5 text-center text-[10px] font-bold text-[#FF2D78] bg-gradient-to-t from-[#FF2D78]/20 to-transparent">
              KEIN ARTWORK
            </div>
          </>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest"
          style={{ background: rarity.color + "22", color: rarity.color, border: `1px solid ${rarity.color}` }}>
          {rarity.label}
        </div>
        {hasImage && (
          <button onClick={remove} disabled={busy} className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg hover:bg-[#FF2D78]">
            × Löschen
          </button>
        )}
      </div>
      <div className="p-3">
        <div className="font-black text-sm text-white">{SLOT_EMOJI[item.slot] ?? item.emoji} {item.name}</div>
        <div className="text-[10px] text-[#a8b4cf] mt-1 flex items-center gap-2 flex-wrap">
          <span>{SLOT_LABEL[item.slot] ?? item.slot}</span>
          {item.class_id && (
            <span style={{ color: CLASS_LABEL[item.class_id]?.color ?? "#a8b4cf" }} className="font-bold">
              · {CLASS_LABEL[item.class_id]?.icon} {CLASS_LABEL[item.class_id]?.label}
            </span>
          )}
        </div>

        <button onClick={copy} className={`mt-2 w-full text-[11px] rounded-lg py-1.5 font-bold ${hasImage ? "bg-[#4ade80]/15 border border-[#4ade80]/50 text-[#4ade80]" : "bg-[#0F1115] border border-[#22D1C3]/40 text-[#22D1C3]"}`}>
          {copied ? "✓ Kopiert" : "📋 Bild-Prompt"}
        </button>

        <label className={`mt-2 block w-full text-center text-[11px] rounded-lg py-1.5 cursor-pointer font-bold ${
          busy ? "bg-[#333] text-[#888]" : hasImage ? "bg-[#4ade80] text-[#0F1115]" : "bg-gradient-to-r from-[#FF2D78] to-[#a855f7] text-white"
        }`}>
          {busy ? "Lädt…" : hasImage ? "🔄 Ersetzen" : "⬆️ Bild hochladen"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </label>

        {err && <div className="mt-2 p-2 rounded-lg bg-[#FF2D78]/15 border border-[#FF2D78]/50 text-[11px] text-[#FF2D78]">{err}</div>}
      </div>
    </div>
  );
}

function buildItemPrompt(item: Item): string {
  // Item-Slot-IDs (DB) → ArtworkSlot-Labels (DE).
  const slotMap: Record<string, "Helm" | "Brustplatte" | "Hose" | "Stiefel" | "Handschuhe" | "Waffe" | "Halskette" | "Ring"> = {
    helm: "Helm", chest: "Brustplatte", legs: "Hose", boots: "Stiefel",
    gloves: "Handschuhe", weapon: "Waffe", necklace: "Halskette", ring: "Ring",
  };
  const rarityMap: Record<string, "Gewöhnlich" | "Selten" | "Episch" | "Legendär"> = {
    common: "Gewöhnlich", rare: "Selten", epic: "Episch", legend: "Legendär",
  };
  const slot   = slotMap[item.slot];
  const rarity = rarityMap[item.rarity];
  const cls    = item.class_id ?? "tank";
  if (!slot || !rarity) {
    // Legacy-Fallback (alte Items vor 8-Slot-Rework)
    return `Game asset icon for "${item.name}", 1024x1024 transparent PNG, fantasy game UI item, painterly style.`;
  }
  return buildPrompt(slot, cls as "tank" | "support" | "ranged" | "melee", rarity).prompt;
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
      `"${buildArchetypePrompt({ name: a.name, rarity: a.rarity as "common" | "elite" | "epic" | "legendary", classId: a.class_id, guardianType: a.guardian_type, role: a.role, species: a.species, gender: a.gender, abilityName: a.ability_name, lore: a.lore }).replace(/"/g, '""')}"`,
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
          <option value="common">Gewöhnlich</option>
          <option value="elite">Elite</option>
          <option value="epic">Episch</option>
          <option value="legendary">Legendär</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Klassen</option>
          <option value="tank">🛡️ Tank</option>
          <option value="support">✨ Support</option>
          <option value="ranged">🏹 Fernkampf</option>
          <option value="melee">⚔️ Nahkampf</option>
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="ALL">Alle Rollen</option>
          <optgroup label="🛡️ Tank">
            <option value="krieger">Krieger</option>
            <option value="ritter">Ritter</option>
            <option value="paladin">Paladin</option>
            <option value="berserker">Berserker</option>
          </optgroup>
          <optgroup label="✨ Support">
            <option value="priester">Priester</option>
            <option value="schamane">Schamane</option>
            <option value="kleriker">Kleriker</option>
            <option value="orakel">Orakel</option>
          </optgroup>
          <optgroup label="🏹 Fernkampf">
            <option value="magier">Magier</option>
            <option value="bogenschuetze">Bogenschütze</option>
            <option value="hexer">Hexer</option>
            <option value="runenmeister">Runenmeister</option>
          </optgroup>
          <optgroup label="⚔️ Nahkampf">
            <option value="schurke">Schurke</option>
            <option value="moench">Mönch</option>
            <option value="samurai">Samurai</option>
            <option value="ninja">Ninja</option>
          </optgroup>
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

      {/* Progress-Bar + Wipe-Button */}
      <div className="mb-4 p-3 rounded-xl bg-[#1A1D23] border border-white/10">
        <div className="flex items-center justify-between mb-2 text-xs text-[#a8b4cf]">
          <span><strong className="text-white">{filtered.length}</strong> gefiltert · {done}/{archetypes.length} mit Bild ({pct}%)</span>
          <div className="flex items-center gap-2">
            <span className="text-[#4ade80] font-bold">{done === archetypes.length ? "🎉 Alle fertig!" : `${archetypes.length - done} offen`}</span>
            <WipeArchetypeArtworksButton onDone={onChange} />
          </div>
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

function WipeArchetypeArtworksButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState<string | null>(null);
  return (
    <>
      <button
        onClick={async () => {
          if (!confirm("ALLE Wächter-Artworks (Bild + Video) aus Storage und DB löschen? Nicht rückgängig zu machen.")) return;
          setBusy(true); setMsg(null);
          try {
            const res = await fetch("/api/admin/artwork/wipe-archetypes", { method: "POST" });
            const j = await res.json();
            if (!res.ok) setMsg(`❌ ${j.error ?? "Fehler"}`);
            else { setMsg(`✅ ${j.removed} Files entfernt`); onDone(); }
          } finally { setBusy(false); }
        }}
        disabled={busy}
        className="bg-[#FF2D78]/20 border border-[#FF2D78]/50 text-[#FF2D78] rounded-lg px-3 py-1 text-xs font-bold hover:bg-[#FF2D78]/30 disabled:opacity-50"
        title="Löscht alle Wächter-Bilder/Videos für Re-Generierung mit neuen Prompts"
      >
        {busy ? "Lösche…" : "🗑️ Wipe Artworks"}
      </button>
      {msg && <span className="text-[10px] text-[#a8b4cf]">{msg}</span>}
    </>
  );
}

function ArchetypeCard({ archetype: a, onChange }: { archetype: Archetype; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [copiedKind, setCopiedKind] = useState<"image" | "video" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const promptInputBase = {
    name: a.name,
    rarity: a.rarity as "common" | "elite" | "epic" | "legendary",
    classId: a.class_id,
    guardianType: a.guardian_type,
    role: a.role,
    species: a.species,
    gender: a.gender,
    abilityName: a.ability_name,
    lore: a.lore,
  };
  const promptImage = buildArchetypePrompt({ ...promptInputBase, mode: "image" });
  const promptVideo = buildArchetypePrompt({ ...promptInputBase, mode: "video" });

  const rarityMeta = RARITY_LABEL[a.rarity] ?? RARITY_LABEL.epic;
  const classMeta  = a.class_id ? CLASS_LABEL[a.class_id] : null;
  const roleMeta   = a.role ? ROLE_LABEL[a.role] : null;
  // Fallback auf legacy guardian_type, falls class_id leer ist
  const typeFallback = !classMeta && a.guardian_type ? TYPE_LABEL[a.guardian_type] : null;

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const sizeMb = file.size / (1024 * 1024);
      console.log("[artwork-upload]", { archetype: a.id, name: file.name, type: file.type, sizeMb: sizeMb.toFixed(2) });
      if (sizeMb > 50) {
        const msg = `Datei ist ${sizeMb.toFixed(1)} MB — über dem 50-MB-Limit. Komprimier das Video (z.B. mit HandBrake) auf unter 50 MB.`;
        setErr(msg); alert(msg); return;
      }
      const result = await uploadArtworkDirect(file, "archetype", a.id);
      if (!result.ok) {
        console.error("[artwork-upload] failed", result.error);
        setErr(result.error);
        alert(`Upload-Fehler für "${a.name}":\n\n${result.error}`);
      } else {
        console.log("[artwork-upload] ok", result);
        onChange();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      console.error("[artwork-upload] exception", e);
      setErr(msg);
      alert(`Upload-Fehler: ${msg}`);
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
  // Cache-Buster wird jetzt zentral in reload() angehängt — URLs hier einfach weiterreichen
  const imgSrc = a.image_url ?? undefined;
  const vidSrc = a.video_url ?? undefined;

  return (
    <div className={`rounded-xl overflow-hidden transition ${done ? "border-[#4ade80]/50" : "border-white/10"}`}
      style={{ background: "#1A1D23", border: `1px solid ${done ? "#4ade8055" : rarityMeta.color + "33"}` }}>
      {/* Preview: Video > Image > Fallback */}
      <div className="aspect-square bg-[#0F1115] flex items-center justify-center relative overflow-hidden">
        {hasVideo ? (
          <video src={vidSrc} poster={imgSrc}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
            style={{ filter: "url(#ma365-chroma-black)" }} />
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={a.name} className="w-full h-full object-cover" />
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
        <div className="text-[10px] text-[#8B8FA3] flex items-center gap-2 mt-1 flex-wrap">
          {classMeta && (
            <span style={{ color: classMeta.color }} className="font-bold">
              {classMeta.icon} {classMeta.label}
            </span>
          )}
          {roleMeta && (
            <span style={{ color: classMeta?.color ?? "#a8b4cf" }} className="font-bold">
              {roleMeta.icon} {roleMeta.label}
            </span>
          )}
          {!classMeta && typeFallback && (
            <span style={{ color: typeFallback.color }} className="font-bold">
              {typeFallback.icon} {typeFallback.label}
            </span>
          )}
        </div>
        {a.species && (
          <div className="text-[9px] text-[#6c7590] mt-0.5 uppercase tracking-wider">{a.species}{a.gender && a.gender !== "neutral" ? ` · ${a.gender}` : ""}</div>
        )}
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

        {err && (
          <div className="mt-2 p-2 rounded-lg bg-[#FF2D78]/15 border border-[#FF2D78]/50 text-[11px] text-[#FF2D78] wrap-break-word">
            <strong className="block mb-0.5">Fehler:</strong>{err}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Siegel (5 Typen)                                      */
/* ═════════════════════════════════════════════════════════ */
function SiegelTab({ artMap, onChange }: {
  artMap: Record<string, { image_url: string | null; video_url: string | null }>;
  onChange: () => void;
}) {
  const done = SIEGEL_TYPES.filter((s) => artMap[s.id]?.image_url || artMap[s.id]?.video_url).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-xs text-[#a8b4cf]">
        <strong className="text-white">{SIEGEL_TYPES.length} Siegel-Typen</strong>
        <span>·</span>
        <span>{done}/{SIEGEL_TYPES.length} mit Artwork</span>
        {done === SIEGEL_TYPES.length && <span className="text-[#4ade80] font-bold">🎉 komplett</span>}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {SIEGEL_TYPES.map((s) => {
          const art = artMap[s.id];
          const hasArt = !!(art?.image_url || art?.video_url);
          return (
            <div key={s.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-16 h-16 flex items-center justify-center rounded-lg overflow-hidden"
                  style={{ background: `radial-gradient(circle at center, ${s.color}33 0%, transparent 70%), #0F1115`, border: `1px solid ${s.color}55` }}
                >
                  {art?.video_url ? <video src={art.video_url} autoPlay loop muted playsInline className="w-16 h-16 object-contain" />
                    : art?.image_url ? <img src={art.image_url} alt={s.name} className="w-16 h-16 object-contain" />
                    : <span className="text-3xl" style={{ filter: `drop-shadow(0 0 6px ${s.color}88)` }}>🏅</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold tracking-wider" style={{ color: s.color }}>SIEGEL</div>
                  <div className="text-sm font-black text-white truncate">{s.name}</div>
                  <div className="text-[10px] text-[#a8b4cf] truncate">{s.hint}</div>
                </div>
                {!hasArt && <span className="text-[9px] font-bold text-[#FF2D78]">LEER</span>}
              </div>
              <AdminArtworkControls
                targetType="siegel"
                targetId={s.id}
                hasImage={!!art?.image_url}
                hasVideo={!!art?.video_url}
                buildPrompt={(mode) => buildSiegelPrompt({ id: s.id, name: s.name, mode })}
                onUploaded={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Tränke (16 Potions)                                   */
/* ═════════════════════════════════════════════════════════ */
function PotionTab({ artMap, onChange }: {
  artMap: Record<string, { image_url: string | null; video_url: string | null }>;
  onChange: () => void;
}) {
  const done = POTION_CATALOG_ART.filter((p) => artMap[p.id]?.image_url || artMap[p.id]?.video_url).length;
  const rarityGroups: Array<{ key: string; label: string; color: string }> = [
    { key: "common", label: "Gewöhnlich", color: "#8B8FA3" },
    { key: "rare",   label: "Selten",     color: "#5ddaf0" },
    { key: "epic",   label: "Episch",     color: "#a855f7" },
  ];
  return (
    <div>
      <div className="mb-3 text-xs text-[#a8b4cf]">
        <strong className="text-white">{POTION_CATALOG_ART.length} Tränke</strong> · {done}/{POTION_CATALOG_ART.length} mit Artwork
      </div>
      {rarityGroups.map((g) => {
        const list = POTION_CATALOG_ART.filter((p) => p.rarity === g.key);
        return (
          <div key={g.key} className="mb-5">
            <div className="text-[11px] font-black tracking-widest mb-2" style={{ color: g.color }}>
              {g.label.toUpperCase()} ({list.length})
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {list.map((p) => {
                const art = artMap[p.id];
                const hasArt = !!(art?.image_url || art?.video_url);
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-[#0F1115]" style={{ border: `1px solid ${g.color}55` }}>
                        {art?.video_url ? <video src={art.video_url} autoPlay loop muted playsInline className="w-14 h-14 object-contain" />
                          : art?.image_url ? <img src={art.image_url} alt={p.name} className="w-14 h-14 object-contain" />
                          : <span className="text-2xl">{p.emoji}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: g.color }}>TRANK</div>
                        <div className="text-sm font-black text-white truncate">{p.name}</div>
                        <div className="text-[9px] text-[#6c7590] truncate">{p.hint}</div>
                      </div>
                      {!hasArt && <span className="text-[9px] font-bold text-[#FF2D78]">LEER</span>}
                    </div>
                    <AdminArtworkControls
                      targetType="potion"
                      targetId={p.id}
                      hasImage={!!art?.image_url}
                      hasVideo={!!art?.video_url}
                      buildPrompt={(mode) => buildPotionPrompt({ id: p.id, name: p.name, rarity: p.rarity, hint: p.hint, mode })}
                      onUploaded={onChange}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Ränge (10 Runner-Ranks)                               */
/* ═════════════════════════════════════════════════════════ */
function RankTab({ artMap, onChange }: {
  artMap: Record<string, { image_url: string | null; video_url: string | null }>;
  onChange: () => void;
}) {
  const done = RANK_TIERS_ART.filter((r) => artMap[r.id]?.image_url || artMap[r.id]?.video_url).length;
  return (
    <div>
      <div className="mb-3 text-xs text-[#a8b4cf]">
        <strong className="text-white">{RANK_TIERS_ART.length} Ränge</strong> · {done}/{RANK_TIERS_ART.length} mit Artwork
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {RANK_TIERS_ART.map((r, idx) => {
          const art = artMap[r.id];
          const hasArt = !!(art?.image_url || art?.video_url);
          return (
            <div key={r.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-16 h-16 flex items-center justify-center rounded-full overflow-hidden relative"
                  style={{ background: `radial-gradient(circle at center, ${r.color}33 0%, transparent 70%), #0F1115`, border: `1.5px solid ${r.color}aa`, boxShadow: `0 0 16px ${r.color}44` }}
                >
                  {art?.video_url ? <video src={art.video_url} autoPlay loop muted playsInline className="w-16 h-16 object-contain" />
                    : art?.image_url ? <img src={art.image_url} alt={r.name} className="w-16 h-16 object-contain" />
                    : <span className="text-xl font-black" style={{ color: r.color }}>#{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold tracking-wider" style={{ color: r.color }}>RANG · {r.tier.toUpperCase()}</div>
                  <div className="text-sm font-black text-white truncate">{r.name}</div>
                  <div className="text-[9px] text-[#6c7590] truncate">{r.hint}</div>
                </div>
                {!hasArt && <span className="text-[9px] font-bold text-[#FF2D78]">LEER</span>}
              </div>
              <AdminArtworkControls
                targetType="rank"
                targetId={r.id}
                hasImage={!!art?.image_url}
                hasVideo={!!art?.video_url}
                buildPrompt={(mode) => buildRankPrompt({ id: r.id, name: r.name, tier: r.tier, color: r.color, hint: r.hint, mode })}
                onUploaded={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/*  Tab: Materialien (4 Crafting-Stufen)                       */
/* ═════════════════════════════════════════════════════════ */

const MATERIAL_TIER_META: Record<number, { label: string; color: string }> = {
  0: { label: "Schrott (Tier 0)",   color: "#8B8FA3" },
  1: { label: "Kristall (Tier 1)",  color: "#5ddaf0" },
  2: { label: "Essenz (Tier 2)",    color: "#a855f7" },
  3: { label: "Relikt (Tier 3)",    color: "#FFD700" },
};

function MaterialTab({ materials, onChange }: { materials: Material[]; onChange: () => void }) {
  if (materials.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-[#8B8FA3]">
        Keine Materialien gefunden — Migration <code className="text-[#22D1C3]">00029_equipment_materials.sql</code> + <code className="text-[#22D1C3]">00066_material_artwork_columns.sql</code> ausführen.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 text-xs text-[#a8b4cf]">
        <strong className="text-white">{materials.length} Materialien</strong> · {materials.filter(m => m.image_url || m.video_url).length}/{materials.length} mit Artwork
        <div className="mt-1 text-[11px] text-[#6c7590]">
          Materialien droppen beim Lauf und werden zum Upgraden von Items genutzt. Eigene Grafik überschreibt das Emoji-Fallback in allen UI-Stellen.
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {materials.map((m) => {
          const meta = MATERIAL_TIER_META[m.tier] ?? MATERIAL_TIER_META[0];
          const hasArt = !!(m.image_url || m.video_url);
          return (
            <div key={m.id} className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-[#0F1115]" style={{ border: `1px solid ${meta.color}55` }}>
                  {m.video_url ? <video src={m.video_url} autoPlay loop muted playsInline className="w-16 h-16 object-contain" />
                    : m.image_url ? <img src={m.image_url} alt={m.name} className="w-16 h-16 object-contain" />
                    : <span className="text-3xl">{m.emoji}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold tracking-wider" style={{ color: meta.color }}>{meta.label.toUpperCase()}</div>
                  <div className="text-sm font-black text-white truncate">{m.name}</div>
                  {m.description && <div className="text-[10px] text-[#6c7590] truncate">{m.description}</div>}
                </div>
                {!hasArt && <span className="text-[9px] font-bold text-[#FF2D78]">LEER</span>}
              </div>
              <AdminArtworkControls
                targetType="material"
                targetId={m.id}
                hasImage={!!m.image_url}
                hasVideo={!!m.video_url}
                buildPrompt={(mode) => buildMaterialPrompt({ id: m.id, name: m.name, tier: m.tier, hint: m.description ?? m.emoji, mode })}
                onUploaded={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

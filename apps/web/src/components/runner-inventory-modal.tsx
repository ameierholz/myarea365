"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useInventoryItemArt } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type Rarity = "common" | "rare" | "epic" | "legendary";

const RARITY_META: Record<Rarity, { color: string; glow: string; label: string }> = {
  common:    { color: "#a8b4cf", glow: "rgba(168,180,207,0.25)", label: "Gewöhnlich" },
  rare:      { color: "#5ddaf0", glow: "rgba(93,218,240,0.40)",  label: "Selten" },
  epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.45)",  label: "Episch" },
  legendary: { color: "#FFD700", glow: "rgba(255,215,0,0.45)",   label: "Legendär" },
};

type Category = "equipment" | "potions" | "xp" | "materials" | "speedup" | "boost" | "other";

type EquipmentRow = {
  id: string;
  item_id: string;
  upgrade_tier: number | null;
  item_catalog: {
    id: string; name: string; emoji: string; slot: string; rarity: Rarity;
    image_url: string | null;
  } | null;
};

type PotionCatalog = {
  id: string; name: string; icon: string; rarity: Rarity;
  effect_key: string; effect_value: number; duration_min: number; description: string;
};
type PotionInv = {
  id: string; potion_id: string; acquired_at: string;
  activated_at: string | null; expires_at: string | null;
};

type XpRow = {
  item_id: string; count: number;
  guardian_xp_items: { id: string; name: string; emoji: string; xp_value: number; rarity: Rarity; image_url: string | null } | null;
};

type Materials = { scrap: number; crystal: number; essence: number; relikt: number };

type GenericCatalog = {
  id: string; category: "speedup" | "boost" | "chest" | "key" | "elixir" | "token" | "misc";
  name: string; description: string | null; emoji: string | null; image_url: string | null;
  rarity: Rarity; payload: Record<string, unknown>; sort_order: number;
};
type GenericInv = { catalog_id: string; count: number };

type ApiResponse = {
  equipment: EquipmentRow[];
  potions: { catalog: PotionCatalog[]; inventory: PotionInv[] };
  guardianXp: XpRow[];
  materials: Materials;
  generic: { catalog: GenericCatalog[]; inventory: GenericInv[] };
};

type DetailItem = {
  key: string;
  name: string;
  description?: string;
  emoji: string;
  imageUrl?: string | null;
  rarity: Rarity;
  count?: number;
  meta?: string;
  consumeId?: string; // catalog_id für consume-API
  category?: GenericCatalog["category"];
  payload?: Record<string, unknown>;
};

export function RunnerInventoryModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("RunnerInventory");
  const tCommon = useTranslations("Common");
  const inventoryItemArt = useInventoryItemArt();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [active, setActive] = useState<Category>("equipment");
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/runner/inventory");
      if (!r.ok) { setError(t("loadError")); return; }
      setData(await r.json() as ApiResponse);
    } catch {
      setError(t("loadError"));
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  // Cache potion-counts (Inventar gruppiert by potion_id)
  const potionCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const p of data.potions.inventory) {
      m.set(p.potion_id, (m.get(p.potion_id) ?? 0) + 1);
    }
    return m;
  }, [data]);

  // Generic inventory: by category
  const genericByCategory = useMemo(() => {
    if (!data) return { speedup: [] as Array<GenericCatalog & { count: number }>, boost: [] as Array<GenericCatalog & { count: number }>, other: [] as Array<GenericCatalog & { count: number }> };
    const counts = new Map(data.generic.inventory.map((i) => [i.catalog_id, i.count]));
    const out = { speedup: [] as Array<GenericCatalog & { count: number }>, boost: [] as Array<GenericCatalog & { count: number }>, other: [] as Array<GenericCatalog & { count: number }> };
    for (const c of data.generic.catalog) {
      const count = counts.get(c.id) ?? 0;
      // Cosmetic artwork (Admin → Inventar-Items) überschreibt DB-image_url
      const art = inventoryItemArt[c.id];
      const image_url = art?.image_url ?? art?.video_url ?? c.image_url;
      const item = { ...c, count, image_url };
      if (c.category === "speedup") out.speedup.push(item);
      else if (c.category === "boost") out.boost.push(item);
      else out.other.push(item);
    }
    return out;
  }, [data, inventoryItemArt]);

  async function consume(catalogId: string) {
    if (busy) return;
    setBusy(catalogId);
    try {
      const r = await fetch("/api/runner/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume", catalog_id: catalogId, count: 1 }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (j?.ok) {
        setToast(t("consumed"));
        setSelected(null);
        await load();
        setTimeout(() => setToast(null), 2000);
      } else {
        setToast(j?.error ?? t("consumeError"));
        setTimeout(() => setToast(null), 2500);
      }
    } finally {
      setBusy(null);
    }
  }

  async function openResourceChest(itemId: string, choice: string | null) {
    if (busy) return;
    setBusy(itemId);
    try {
      const r = await fetch("/api/runner/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_resource_chest", item_id: itemId, choice }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; resource?: string; amount?: number; error?: string } | null;
      if (j?.ok) {
        const labelMap: Record<string, string> = { gold: "Krypto", wood: "Tech-Schrott", stone: "Komponenten", mana: "Bandbreite" };
        setToast(`+${j.amount?.toLocaleString("de-DE")} ${labelMap[j.resource ?? ""] ?? j.resource}`);
        setSelected(null);
        await load();
      } else {
        setToast(j?.error ?? t("consumeError"));
      }
      setTimeout(() => setToast(null), 2500);
    } finally { setBusy(null); }
  }

  async function openChestWithKey(itemId: string) {
    if (busy) return;
    setBusy(itemId);
    try {
      const r = await fetch("/api/runner/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_chest", item_id: itemId }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; tier?: string; reward?: unknown[]; error?: string; required_key?: string } | null;
      if (j?.ok) {
        setToast(`Truhe geöffnet (${j.reward?.length ?? 0} Belohnungen)`);
        setSelected(null);
        await load();
      } else if (j?.error === "missing_key") {
        setToast(`Fehlender Schlüssel: ${j.required_key}`);
      } else {
        setToast(j?.error ?? t("consumeError"));
      }
      setTimeout(() => setToast(null), 3000);
    } finally { setBusy(null); }
  }

  const tabs: Array<{ id: Category; icon: string; labelKey: string; color: string }> = [
    { id: "equipment",  icon: "🗡",  labelKey: "tabEquipment",  color: PRIMARY },
    { id: "potions",    icon: "🧪",  labelKey: "tabPotions",    color: "#a855f7" },
    { id: "xp",         icon: "📚",  labelKey: "tabXp",         color: GOLD },
    { id: "materials",  icon: "🧱",  labelKey: "tabMaterials",  color: "#FF6B4A" },
    { id: "speedup",    icon: "⚡",  labelKey: "tabSpeedup",    color: "#4ade80" },
    { id: "boost",      icon: "🛡",  labelKey: "tabBoost",      color: "#5ddaf0" },
    { id: "other",      icon: "🎁",  labelKey: "tabOther",      color: PINK },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 760, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${PRIMARY}1f 0%, #141a2d 100%)`,
        borderRadius: 18, border: `1px solid ${PRIMARY}66`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>📦</span>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.5 }}>{t("title")}</span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16,
            background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }} aria-label={tCommon("close")}>×</button>
        </div>

        {/* Tabs (horizontal scrollable on mobile) */}
        <div style={{
          display: "flex", gap: 4, padding: "8px 12px",
          overflowX: "auto", scrollbarWidth: "none",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(0,0,0,0.2)",
        }}>
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActive(tab.id); setSelected(null); }} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "8px 12px", minWidth: 64, flexShrink: 0,
                borderRadius: 10,
                background: isActive ? `${tab.color}28` : "transparent",
                border: isActive ? `1px solid ${tab.color}` : "1px solid transparent",
                color: isActive ? tab.color : TEXT_SOFT,
                cursor: "pointer", fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 20 }}>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12, position: "relative" }}>
          {error && <div style={{ padding: 24, textAlign: "center", color: PINK }}>{error}</div>}
          {!data && !error && <div style={{ padding: 24, textAlign: "center", color: TEXT_SOFT }}>{t("loading")}</div>}

          {data && active === "equipment" && (
            <EquipmentTab items={data.equipment} onSelect={(item) => setSelected(item)} />
          )}
          {data && active === "potions" && (
            <PotionsTab catalog={data.potions.catalog} counts={potionCounts} onSelect={setSelected} />
          )}
          {data && active === "xp" && (
            <XpTab items={data.guardianXp} onSelect={setSelected} />
          )}
          {data && active === "materials" && (
            <MaterialsTab mats={data.materials} onSelect={setSelected} />
          )}
          {data && active === "speedup" && (
            <GenericTab items={genericByCategory.speedup} onSelect={setSelected} t={t} />
          )}
          {data && active === "boost" && (
            <GenericTab items={genericByCategory.boost} onSelect={setSelected} t={t} />
          )}
          {data && active === "other" && (
            <GenericTab items={genericByCategory.other} onSelect={setSelected} t={t} />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.9)", color: "#FFF", fontSize: 12, fontWeight: 700,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 10,
          }}>{toast}</div>
        )}

        {/* Detail-Sheet (slides up from bottom) */}
        {selected && (
          <DetailSheet
            item={selected}
            onClose={() => setSelected(null)}
            onConsume={selected.consumeId ? () => consume(selected.consumeId!) : undefined}
            onOpenChest={selected.category === "chest" && selected.consumeId
              ? (() => {
                  const kind = (selected.payload?.kind as string | undefined);
                  if (kind === "random_one") return () => openResourceChest(selected.consumeId!, null);
                  if (kind === "choice_one") return undefined; // handled via onChoiceChest below
                  return () => openChestWithKey(selected.consumeId!);
                })()
              : undefined}
            onChoiceChest={selected.category === "chest" && selected.consumeId && (selected.payload?.kind === "choice_one")
              ? (choice) => openResourceChest(selected.consumeId!, choice)
              : undefined}
            chestOptions={selected.category === "chest" && (selected.payload?.kind === "choice_one")
              ? (selected.payload?.options as Array<{ resource: string; amount: number }> | undefined)
              : undefined}
            busy={busy === selected.consumeId}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab: Equipment ─────────────────────────────────────────────
function EquipmentTab({ items, onSelect }: { items: EquipmentRow[]; onSelect: (d: DetailItem) => void }) {
  const t = useTranslations("RunnerInventory");
  if (items.length === 0) {
    return <EmptyState text={t("emptyEquipment")} />;
  }
  return (
    <Grid>
      {items.map((it) => {
        if (!it.item_catalog) return null;
        const cat = it.item_catalog;
        return (
          <ItemCard
            key={it.id}
            emoji={cat.emoji}
            imageUrl={cat.image_url}
            name={cat.name}
            rarity={cat.rarity}
            countBadge={it.upgrade_tier && it.upgrade_tier > 0 ? `+${it.upgrade_tier}` : null}
            onClick={() => onSelect({
              key: it.id,
              name: cat.name,
              description: `Slot: ${cat.slot}`,
              emoji: cat.emoji,
              imageUrl: cat.image_url,
              rarity: cat.rarity,
              meta: it.upgrade_tier && it.upgrade_tier > 0 ? `+${it.upgrade_tier}` : undefined,
            })}
          />
        );
      })}
    </Grid>
  );
}

// ─── Tab: Potions ────────────────────────────────────────────────
function PotionsTab({ catalog, counts, onSelect }: { catalog: PotionCatalog[]; counts: Map<string, number>; onSelect: (d: DetailItem) => void }) {
  const t = useTranslations("RunnerInventory");
  const owned = catalog.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (owned.length === 0) return <EmptyState text={t("emptyPotions")} />;
  return (
    <Grid>
      {owned.map((p) => {
        const count = counts.get(p.id) ?? 0;
        return (
          <ItemCard
            key={p.id}
            emoji={p.icon}
            name={p.name}
            rarity={p.rarity}
            countBadge={count > 1 ? String(count) : null}
            onClick={() => onSelect({
              key: p.id,
              name: p.name,
              description: p.description,
              emoji: p.icon,
              rarity: p.rarity,
              count,
              meta: `${p.duration_min} min`,
            })}
          />
        );
      })}
    </Grid>
  );
}

// ─── Tab: Guardian XP ────────────────────────────────────────────
function XpTab({ items, onSelect }: { items: XpRow[]; onSelect: (d: DetailItem) => void }) {
  const t = useTranslations("RunnerInventory");
  const owned = items.filter((i) => i.count > 0 && i.guardian_xp_items);
  if (owned.length === 0) return <EmptyState text={t("emptyXp")} />;
  return (
    <Grid>
      {owned.map((it) => {
        const cat = it.guardian_xp_items!;
        return (
          <ItemCard
            key={it.item_id}
            emoji={cat.emoji}
            imageUrl={cat.image_url}
            name={cat.name}
            rarity={cat.rarity}
            countBadge={String(it.count)}
            onClick={() => onSelect({
              key: it.item_id,
              name: cat.name,
              description: `+${cat.xp_value} XP`,
              emoji: cat.emoji,
              imageUrl: cat.image_url,
              rarity: cat.rarity,
              count: it.count,
            })}
          />
        );
      })}
    </Grid>
  );
}

// ─── Tab: Materials ──────────────────────────────────────────────
function MaterialsTab({ mats, onSelect }: { mats: Materials; onSelect: (d: DetailItem) => void }) {
  const t = useTranslations("RunnerInventory");
  const list: Array<{ key: keyof Materials; emoji: string; name: string; rarity: Rarity }> = [
    { key: "scrap",   emoji: "🔩", name: t("matScrap"),   rarity: "common" },
    { key: "crystal", emoji: "💠", name: t("matCrystal"), rarity: "rare" },
    { key: "essence", emoji: "🌑", name: t("matEssence"), rarity: "epic" },
    { key: "relikt",  emoji: "🏺", name: t("matRelikt"),  rarity: "legendary" },
  ];
  const owned = list.filter((m) => mats[m.key] > 0);
  if (owned.length === 0) return <EmptyState text={t("emptyMaterials")} />;
  return (
    <Grid>
      {owned.map((m) => (
        <ItemCard
          key={m.key}
          emoji={m.emoji}
          name={m.name}
          rarity={m.rarity}
          countBadge={String(mats[m.key])}
          onClick={() => onSelect({
            key: m.key,
            name: m.name,
            description: t("matDesc"),
            emoji: m.emoji,
            rarity: m.rarity,
            count: mats[m.key],
          })}
        />
      ))}
    </Grid>
  );
}

// ─── Tab: Generic (Speedup/Boost/Other) ──────────────────────────
function GenericTab({ items, onSelect, t }: {
  items: Array<GenericCatalog & { count: number }>;
  onSelect: (d: DetailItem) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const owned = items.filter((i) => i.count > 0);
  if (owned.length === 0) return <EmptyState text={t("emptyGeneric")} />;
  return (
    <Grid>
      {owned.map((it) => (
        <ItemCard
          key={it.id}
          emoji={it.emoji ?? "📦"}
          imageUrl={it.image_url}
          name={it.name}
          rarity={it.rarity}
          countBadge={it.count > 0 ? String(it.count) : null}
          onClick={() => onSelect({
            key: it.id,
            name: it.name,
            description: it.description ?? undefined,
            emoji: it.emoji ?? "📦",
            imageUrl: it.image_url,
            rarity: it.rarity,
            count: it.count,
            consumeId: it.id,
            category: it.category,
            payload: it.payload,
          })}
        />
      ))}
    </Grid>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
      gap: 8,
    }}>{children}</div>
  );
}

function ItemCard({ emoji, imageUrl, name, rarity, countBadge, onClick }: {
  emoji: string; imageUrl?: string | null; name: string; rarity: Rarity;
  countBadge?: string | null; onClick: () => void;
}) {
  const r = RARITY_META[rarity];
  return (
    <button onClick={onClick} title={name} style={{
      position: "relative",
      aspectRatio: "1",
      background: `linear-gradient(135deg, ${r.color}22, rgba(15,17,21,0.8))`,
      border: `1.5px solid ${r.color}88`,
      borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
      boxShadow: `0 0 8px ${r.glow}`,
      padding: 4,
    }}>
      {imageUrl ? (
        imageUrl.endsWith(".mp4") || imageUrl.endsWith(".webm")
          ? <video src={imageUrl} autoPlay loop muted playsInline style={{ width: "75%", height: "75%", objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
          : <img src={imageUrl} alt="" style={{ width: "75%", height: "75%", objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
      ) : (
        <span style={{ fontSize: 32 }}>{emoji}</span>
      )}
      {countBadge && (
        <div style={{
          position: "absolute", bottom: 2, right: 4,
          color: "#FFF", fontSize: 11, fontWeight: 900,
          textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
        }}>{countBadge}</div>
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center", color: MUTED,
      fontSize: 13, lineHeight: 1.5,
    }}>{text}</div>
  );
}

function DetailSheet({ item, onClose, onConsume, onOpenChest, onChoiceChest, chestOptions, busy, t }: {
  item: DetailItem; onClose: () => void;
  onConsume?: () => void;
  onOpenChest?: () => void;
  onChoiceChest?: (choice: string) => void;
  chestOptions?: Array<{ resource: string; amount: number }>;
  busy: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const r = RARITY_META[item.rarity];
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 5,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxHeight: "70%",
        background: `linear-gradient(180deg, ${r.color}22 0%, #141a2d 100%)`,
        borderTop: `2px solid ${r.color}`,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 16, color: "#F0F0F0",
        boxShadow: `0 -4px 20px ${r.glow}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12,
            background: `${r.color}33`, border: `2px solid ${r.color}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: `0 0 16px ${r.glow}`,
          }}>
            {item.imageUrl ? (
              item.imageUrl.endsWith(".mp4") || item.imageUrl.endsWith(".webm")
                ? <video src={item.imageUrl} autoPlay loop muted playsInline style={{ width: "80%", height: "80%", objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                : <img src={item.imageUrl} alt="" style={{ width: "80%", height: "80%", objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
            ) : (
              <span style={{ fontSize: 36 }}>{item.emoji}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.2 }}>
              {RARITY_META[item.rarity].label.toUpperCase()}
              {item.count != null && <span style={{ color: TEXT_SOFT, marginLeft: 6 }}>· {t("count")}: {item.count}</span>}
              {item.meta && <span style={{ color: TEXT_SOFT, marginLeft: 6 }}>· {item.meta}</span>}
            </div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2 }}>{item.name}</div>
          </div>
        </div>
        {item.description && (
          <div style={{ color: TEXT_SOFT, fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>
            {item.description}
          </div>
        )}
        {/* Auswahl-Truhe: 4 Buttons je Ressource */}
        {onChoiceChest && chestOptions && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: TEXT_SOFT, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Wähle Ressource:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {chestOptions.map((o) => {
                const labels: Record<string, { name: string; emoji: string; color: string }> = {
                  gold:  { name: "Krypto",       emoji: "💸", color: "#FFD700" },
                  wood:  { name: "Tech-Schrott", emoji: "⚙️", color: "#a07a3c" },
                  stone: { name: "Komponenten",  emoji: "🔩", color: "#9ba8c7" },
                  mana:  { name: "Bandbreite",   emoji: "📡", color: "#a855f7" },
                };
                const meta = labels[o.resource] ?? { name: o.resource, emoji: "📦", color: "#FFF" };
                return (
                  <button key={o.resource} onClick={() => onChoiceChest(o.resource)} disabled={busy} style={{
                    padding: "10px 12px", borderRadius: 10, border: `1px solid ${meta.color}`,
                    background: `${meta.color}1a`, color: meta.color,
                    fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer",
                  }}>
                    <div style={{ fontSize: 18 }}>{meta.emoji}</div>
                    <div>{o.amount.toLocaleString("de-DE")}</div>
                    <div style={{ fontSize: 10, opacity: 0.85 }}>{meta.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {onOpenChest && (
            <button onClick={onOpenChest} disabled={busy} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: "none",
              background: busy ? "#444" : `linear-gradient(135deg, ${GOLD}, #FF9E2C)`,
              color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: busy ? "wait" : "pointer",
            }}>{busy ? "…" : "Truhe öffnen"}</button>
          )}
          {!onOpenChest && !onChoiceChest && onConsume && (
            <button onClick={onConsume} disabled={busy} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: "none",
              background: busy ? "#444" : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY}aa)`,
              color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: busy ? "wait" : "pointer",
            }}>{busy ? "…" : t("use")}</button>
          )}
          <button onClick={onClose} style={{
            padding: "12px 18px", borderRadius: 10,
            background: "rgba(255,255,255,0.08)", border: `1px solid ${BORDER}`,
            color: "#FFF", fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>{t("close")}</button>
        </div>
      </div>
    </div>
  );
}

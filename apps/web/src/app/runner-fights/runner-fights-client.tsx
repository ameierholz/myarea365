"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getNumberLocale } from "@/i18n/config";
import Link from "next/link";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { CinematicBattleArena } from "@/components/battle-arena";
import { PotionInventoryModal } from "@/components/potion-inventory-modal";
import { GuardianAvatar } from "@/components/guardian-avatar";
import type { RoundEvent } from "@/lib/battle-engine";
import { TYPE_META, typeCounter, type GuardianType } from "@/lib/guardian";

type Opponent = {
  guardian_id: string;
  user_id: string;
  archetype_id: string;
  level: number;
  wins: number;
  losses: number;
  current_hp_pct: number;
  username: string | null;
  display_name: string | null;
  faction: string | null;
  avatar_url: string | null;
  archetype_name: string;
  archetype_emoji: string;
  archetype_image_url?: string | null;
  archetype_video_url?: string | null;
  rarity: string;
  guardian_type: string;
  role: string;
  is_bot?: boolean;
};

type StatBlock = { hp: number; atk: number; def: number; spd: number };
type EquippedItem = {
  user_item_id: string;
  slot: string; name: string; emoji: string; rarity: string; upgrade_tier: number;
  bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number;
  image_url: string | null;
};
type MyGuardian = {
  guardian_id: string;
  archetype_id: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  current_hp_pct: number;
  archetype_name: string;
  archetype_emoji: string;
  archetype_image_url?: string | null;
  archetype_video_url?: string | null;
  rarity: string;
  guardian_type: string | null;
  role: string | null;
  base_stats: StatBlock;
  bonus_stats: StatBlock;
  effective_stats: StatBlock;
  equipped: EquippedItem[];
  inventory_by_slot: Record<string, EquippedItem[]>;
};

type OpponentsResponse = {
  ok: boolean;
  opponents: Opponent[];
  my_guardian?: MyGuardian | null;
  fights_used_today: number;
  gems_spent_today: number;
  refresh_used_today: number;
  next_gem_cost: number | null;
  gems_available: number;
  refresh_cost: number;
  error?: string;
  detail?: string;
};

type AttackResult = {
  ok: boolean;
  rounds?: RoundEvent[];
  winner?: "A" | "B" | null;
  final_hp_a?: number;
  final_hp_b?: number;
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  gems_paid?: number;
  error?: string;
  message?: string;
};

type SeasonInfo = {
  ok: boolean;
  season: { id: string; number: number; name: string; starts_at: string; ends_at: string; status: string } | null;
  seasonal_guardian: { id: string } | null;
  eternal_guardian: { id: string; guardian_archetypes: { name: string; emoji: string } } | null;
  needs_pick: boolean;
};

const DEMO_SEASON: SeasonInfo = {
  ok: true,
  season: {
    id: "demo-season",
    number: 1,
    name: "Saison der Klingen (DEMO)",
    starts_at: new Date(Date.now() - 12 * 86400_000).toISOString(),
    ends_at:   new Date(Date.now() + 78 * 86400_000).toISOString(),
    status: "active",
  },
  seasonal_guardian: null,
  eternal_guardian: {
    id: "demo-eternal",
    guardian_archetypes: { name: "Aegon der Standhafte", emoji: "🛡️" },
  },
  needs_pick: true,
};

export function RunnerFightsClient({ inModal = false, onClose }: { inModal?: boolean; onClose?: () => void } = {}) {
  const t = useTranslations("Arena");
  const [data, setData] = useState<OpponentsResponse | null>(null);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fighting, setFighting] = useState<Opponent | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demoSeason, setDemoSeason] = useState(false);

  async function reload(refresh = false) {
    setLoading(true);
    const [oppRes, seasonRes] = await Promise.all([
      fetch(`/api/runner-fights/opponents${refresh ? "?refresh=1" : ""}`, { cache: "no-store" }),
      fetch("/api/arena/season", { cache: "no-store" }),
    ]);
    if (oppRes.ok)    setData(await oppRes.json());
    if (seasonRes.ok) setSeason(await seasonRes.json());
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function attack(op: Opponent) {
    const nextCost = data?.next_gem_cost ?? 0;
    if (nextCost === -1) {
      await appAlert({ title: t("dailyLimitTitle"), message: t("dailyLimitMessage"), icon: "⏱️" });
      return;
    }
    if (nextCost > 0) {
      const ok = await appConfirm({
        title: t("fightCostsGemsTitle"),
        message: t("fightCostsGemsMessage", { cost: nextCost }),
        confirmLabel: t("fightCostsGemsConfirm", { cost: nextCost }),
        cancelLabel: t("cancel"),
        icon: "💎",
      });
      if (!ok) return;
    }
    setBusyId(op.guardian_id);
    setResult(null);
    try {
      const res = await fetch("/api/runner-fights/attack", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ defender_guardian_id: op.guardian_id }),
      });
      const j = (await res.json()) as AttackResult;
      if (!j.ok) {
        await appAlert({ title: t("fightFailedTitle"), message: j.message ?? j.error ?? t("unknownError"), icon: "⚠️" });
        setBusyId(null);
        return;
      }
      setResult(j);
      setFighting(op);
    } finally {
      setBusyId(null);
    }
  }

  function closeFight() {
    setFighting(null);
    setResult(null);
    void reload();
  }

  const W = inModal
    ? ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    : Wrapper;

  if (loading || !data) {
    return <W><div className="p-10 text-center text-[#8B8FA3]">{t("loadingOpponents")}</div></W>;
  }

  if (demoSeason) {
    return (
      <W>
        <SeasonPicker
          season={DEMO_SEASON.season!}
          eternal={DEMO_SEASON.eternal_guardian}
          demoMode
          onPicked={() => { setDemoSeason(false); void reload(); }}
          onClose={() => setDemoSeason(false)}
        />
      </W>
    );
  }

  if (season?.season && season.needs_pick) {
    return (
      <W>
        <SeasonPicker
          season={season.season}
          eternal={season.eternal_guardian}
          onPicked={() => reload()}
          onClose={inModal ? onClose : undefined}
        />
      </W>
    );
  }

  if (!data.ok) {
    if (data.error === "no_active_guardian") {
      return (
        <W>
          <div className="p-6 rounded-xl bg-[#1A1D23] border border-white/10 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            <div className="text-white font-black">{t("noActiveGuardian")}</div>
            <div className="text-sm text-[#a8b4cf] mt-2">{t("noActiveGuardianHint")}</div>
          </div>
        </W>
      );
    }
    return (
      <W>
        <div className="p-6 rounded-xl bg-[#1A1D23] border border-[#FF2D78]/40 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="text-[#FF2D78] font-black text-lg">{data.error ?? t("unknownError")}</div>
          {data.detail && <div className="text-[#a8b4cf] text-sm mt-2">{data.detail}</div>}
        </div>
      </W>
    );
  }

  const used = data.fights_used_today;
  const freeLeft = Math.max(0, 5 - used);
  const nextCost = data.next_gem_cost ?? 0;
  const totalLimit = 15;

  return (
    <W>
      <ArenaHeader
        onClose={inModal ? onClose : undefined}
        myGuardian={data.my_guardian ?? null}
        freeLeft={freeLeft}
        used={used}
        totalLimit={totalLimit}
        gemsAvailable={data.gems_available}
        nextCost={nextCost}
        onChanged={() => reload()}
      />

      {/* Demo + Info-Zeile */}
      <div style={{ padding: "0 18px 10px", display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {!data.my_guardian && (
          <button onClick={() => setDemoSeason(true)} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer",
            background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc",
          }}>{t("guardianPickButton")}</button>
        )}
        <PrestigeDemoButton />
        <GuardianExplainerButton />
      </div>

      {nextCost === -1 && (
        <div className="mb-3 p-3 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/30 text-sm text-[#FF2D78] font-bold">
          {t("dailyLimitBanner")}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-[#8B8FA3]">
          {t("opponentsAvailable", { count: data.opponents.length })}
          {data.refresh_used_today > 0 && t("shuffledSuffix", { count: data.refresh_used_today })}
        </div>
        <button
          onClick={() => reload(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1A1D23] border border-white/10 hover:bg-white/5 text-[#a8b4cf] font-bold"
        >
          {data.refresh_cost === 0 ? t("shuffleButtonFree") : t("shuffleButtonPaid", { cost: data.refresh_cost })}
        </button>
      </div>

      {data.opponents.length === 0 ? (
        <div className="p-10 text-center text-[#8B8FA3] text-sm">{t("noOpponents")}</div>
      ) : (
        <>
          <div className="text-center text-xs font-black tracking-widest text-[#FFD700] mb-1">
            {t("pickOpponent")}
          </div>
          <div className="text-center text-[10px] text-[#8B8FA3] mb-3" style={{ maxWidth: 540, margin: "0 auto 12px" }}>
            {t("rulesNote")}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {data.opponents.map((op) => (
              <OpponentCard
                key={op.guardian_id}
                op={op}
                myType={(data.my_guardian?.guardian_type ?? null) as GuardianType | null}
                onAttack={() => attack(op)}
                busy={busyId === op.guardian_id}
                disabled={!!busyId}
              />
            ))}
          </div>
        </>
      )}

      {fighting && result?.rounds && (
        <FightModal
          onClose={closeFight}
          opponent={fighting}
          myGuardian={data.my_guardian ?? null}
          rounds={result.rounds}
          settle={result.settle}
          winner={result.winner ?? null}
        />
      )}

    </W>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Arena");
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-xs text-[#8B8FA3] hover:text-white">{t("backDashboard")}</Link>
        <div className="mt-2">{children}</div>
      </div>
    </main>
  );
}

function ArenaHeader({ onClose, myGuardian, freeLeft, used, totalLimit, gemsAvailable, nextCost, onChanged }: {
  onClose?: () => void;
  myGuardian: MyGuardian | null;
  freeLeft: number;
  used: number;
  totalLimit: number;
  gemsAvailable: number;
  nextCost: number | null;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations("Arena");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const myType = myGuardian?.guardian_type && (myGuardian.guardian_type in TYPE_META)
    ? TYPE_META[myGuardian.guardian_type as GuardianType] : null;
  const rarityMeta = myGuardian?.rarity === "legendary"
    ? { color: "#FFD700", label: t("rarityLegendary"), glow: "rgba(255,215,0,0.4)" }
    : myGuardian?.rarity === "epic"
    ? { color: "#a855f7", label: t("rarityEpic"),      glow: "rgba(168,85,247,0.4)" }
    : { color: "#22D1C3", label: t("rarityElite"),     glow: "rgba(34,209,195,0.3)" };

  return (
    <div style={{
      position: "relative",
      marginBottom: 20,
      borderRadius: 18,
      overflow: "hidden",
      background: `
        radial-gradient(ellipse at 50% 120%, rgba(255,107,74,0.25) 0%, transparent 55%),
        radial-gradient(ellipse at 0% 0%, rgba(168,85,247,0.15) 0%, transparent 40%),
        radial-gradient(ellipse at 100% 0%, rgba(34,209,195,0.12) 0%, transparent 40%),
        linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)
      `,
      border: "1px solid rgba(255,107,74,0.35)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 40px rgba(0,0,0,0.5)",
    }}>
      {/* Dekorative Kolosseum-Bögen (CSS Pseudo-Arches) */}
      <div style={{
        position: "absolute", top: -30, left: 0, right: 0, height: 60,
        pointerEvents: "none", opacity: 0.25,
        background: "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,107,74,0.3) 40px 42px)",
        maskImage: "radial-gradient(ellipse at center bottom, black 0%, transparent 70%)",
      }} />

      {/* Crossed Swords Watermark */}
      <div style={{
        position: "absolute", right: -20, top: -10,
        fontSize: 140, opacity: 0.05,
        pointerEvents: "none",
        transform: "rotate(-12deg)",
      }}>⚔️</div>

      {/* Header-Leiste */}
      <div style={{
        position: "relative", padding: "14px 18px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>⚔️</div>
          <div>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>{t("headerKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{t("headerTitle")}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PotionButton />
          {onClose && (
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
              width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 18,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Body: Hero-Panel mit Portrait + Stats + Gear */}
      {myGuardian && (
        <HeroPanel myGuardian={myGuardian} myType={myType} rarityMeta={rarityMeta} onChanged={onChanged} />
      )}

      {/* Arena-Stat-Kacheln */}
      <div style={{
        position: "relative", padding: "0 18px 14px",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      }}>
          <ArenaStatTile
            label={t("freeFightsLabel")}
            value={`${freeLeft}/5`}
            sub={freeLeft > 0 ? t("freeFightsLeft") : t("freeFightsUsed")}
            icon="⚡"
            color={freeLeft > 0 ? "#4ade80" : "#8B8FA3"}
          />
          <ArenaStatTile
            label={t("fightsTodayLabel")}
            value={`${used}/${totalLimit}`}
            sub={t("fightsTodaySub")}
            icon="🗡️"
            color="#22D1C3"
          />
          <ArenaStatTile
            label={t("gemsLabel")}
            value={gemsAvailable.toLocaleString(numLocale)}
            sub={nextCost && nextCost > 0 ? t("gemsNextCost", { cost: nextCost }) : t("gemsBalance")}
            icon="💎"
            color="#FFD700"
          />
      </div>

      {nextCost === -1 && (
        <div style={{ padding: "10px 18px", background: "rgba(255,45,120,0.14)", borderTop: "1px solid rgba(255,45,120,0.3)", color: "#FF2D78", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
          {t("dailyLimitBanner")}
        </div>
      )}

      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-4px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

const SLOT_ORDER: Array<{ key: string; icon: string; labelKey: string }> = [
  { key: "helm",      icon: "⛑️", labelKey: "slotHelm" },
  { key: "shoulders", icon: "🦾", labelKey: "slotShoulders" },
  { key: "chest",     icon: "🛡️", labelKey: "slotChest" },
  { key: "hands",     icon: "🧤", labelKey: "slotHands" },
  { key: "wrist",     icon: "🔗", labelKey: "slotWrist" },
  { key: "boots",     icon: "🥾", labelKey: "slotBoots" },
  { key: "neck",      icon: "📿", labelKey: "slotNeck" },
  { key: "ring",      icon: "💍", labelKey: "slotRing" },
  { key: "weapon",    icon: "⚔️", labelKey: "slotWeapon" },
];

const TIER_COLORS = ["#8B8FA3", "#4ade80", "#a855f7", "#FFD700"];

function HeroPanel({ myGuardian, myType, rarityMeta, onChanged }: {
  myGuardian: MyGuardian;
  myType: { label: string; icon: string; color: string } | null;
  rarityMeta: { color: string; label: string; glow: string };
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations("Arena");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const eff = myGuardian.effective_stats;
  const bon = myGuardian.bonus_stats;
  const equippedMap = new Map(myGuardian.equipped.map((e) => [e.slot, e]));
  const equippedCount = myGuardian.equipped.length;
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ausrüstung immer eingeklappt — Runner soll selbst aufklappen wenn er
  // Slots wechseln will. Spart Platz fuer die Gegner-Liste darunter.
  const [gearOpen, setGearOpen] = useState(false);

  async function equip(userItemId: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip", user_item_id: userItemId }),
      });
      setOpenSlot(null);
      await onChanged();
    } finally { setBusy(false); }
  }
  async function unequip(slot: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unequip", slot }),
      });
      setOpenSlot(null);
      await onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "relative", margin: "0 18px 12px", padding: 14,
      borderRadius: 14,
      background: `radial-gradient(circle at 15% 20%, ${rarityMeta.glow} 0%, transparent 55%), linear-gradient(180deg, rgba(15,17,21,0.75) 0%, rgba(15,17,21,0.95) 100%)`,
      border: `1px solid ${rarityMeta.color}55`,
      boxShadow: `0 4px 28px ${rarityMeta.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center",
    }}>
      {/* Portrait */}
      <div style={{
        position: "relative",
        width: 120, height: 130,
        borderRadius: 12,
        background: `radial-gradient(circle at 50% 40%, ${rarityMeta.color}35 0%, transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)`,
        border: `1px solid ${rarityMeta.color}66`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 6, left: 6, zIndex: 2,
          padding: "2px 6px", borderRadius: 999,
          background: `${rarityMeta.color}dd`, color: "#0F1115",
          fontSize: 8, fontWeight: 900, letterSpacing: 1.2,
        }}>{rarityMeta.label}</div>
        <GuardianAvatar
          archetype={{
            id: myGuardian.archetype_id,
            emoji: myGuardian.archetype_emoji,
            rarity: myGuardian.rarity as "elite" | "epic" | "legendary",
            image_url: myGuardian.archetype_image_url ?? null,
            video_url: myGuardian.archetype_video_url ?? null,
          }}
          size={120}
          fillMode="cover"
          animation="idle"
        />
      </div>

      {/* Mitte: Name + Stats + Gear-Strip */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>
            {myGuardian.archetype_name}
          </div>
          <div style={{
            padding: "2px 8px", borderRadius: 999,
            background: `${rarityMeta.color}22`, border: `1px solid ${rarityMeta.color}66`,
            color: rarityMeta.color, fontSize: 10, fontWeight: 900, letterSpacing: 1,
          }}>{t("level", { level: myGuardian.level })}</div>
          {myType && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 999,
              background: `${myType.color}22`, border: `1px solid ${myType.color}77`,
              color: myType.color, fontSize: 10, fontWeight: 900, letterSpacing: 1,
            }}>
              <span>{myType.icon}</span>
              {myType.label.toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#a8b4cf" }}>
            🏆 <b style={{ color: "#4ade80" }}>{myGuardian.wins}</b> · 💀 <b style={{ color: "#FF2D78" }}>{myGuardian.losses}</b>
          </div>
        </div>

        {/* Stat-Grid 4x */}
        <div style={{
          marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        }}>
          <GearStat label="HP"  value={eff.hp}  bonus={bon.hp}  icon="❤️" color="#4ade80" />
          <GearStat label="ATK" value={eff.atk} bonus={bon.atk} icon="⚔️" color="#FF6B4A" />
          <GearStat label="DEF" value={eff.def} bonus={bon.def} icon="🛡️" color="#60a5fa" />
          <GearStat label="SPD" value={eff.spd} bonus={bon.spd} icon="💨" color="#FFD700" />
        </div>

        {/* Equipment-Strip (klickbar → Inline-Picker) */}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setGearOpen((v) => !v)}
            aria-expanded={gearOpen}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: gearOpen ? "transparent" : "rgba(255,215,0,0.05)",
              border: gearOpen ? "none" : "1px dashed rgba(255,215,0,0.25)",
              borderRadius: 8, padding: gearOpen ? "4px 2px" : "8px 10px",
              color: "#8B8FA3", fontSize: 11, fontWeight: 900, letterSpacing: 1.5,
              cursor: "pointer", marginBottom: gearOpen ? 6 : 0,
              textAlign: "left",
            }}
          >
            <span>
              {t("gearHeader", { equipped: equippedCount, total: SLOT_ORDER.length })}
              <span style={{ color: "#6c7590", fontSize: 10, fontWeight: 700, marginLeft: 8, letterSpacing: 0 }}>
                {gearOpen ? t("gearHintOpen") : t("gearHintClosed")}
              </span>
            </span>
            <span style={{
              fontSize: 12, color: gearOpen ? "#8B8FA3" : "#FFD700",
              transform: gearOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}>▾</span>
          </button>
          <div style={{
            display: gearOpen ? "grid" : "none",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6,
          }}>
            {SLOT_ORDER.map((s, idx) => {
              const eq = equippedMap.get(s.key);
              const tier = eq?.upgrade_tier ?? 0;
              const tierColor = TIER_COLORS[Math.max(0, Math.min(3, tier))];
              const empty = !eq;
              const bonusSummary = eq ? summarizeBonus(eq, tier) : null;
              const isOpen = openSlot === s.key;
              const available = myGuardian.inventory_by_slot[s.key] ?? [];
              // Popover nach links öffnen für die rechten ~40% der Slots (verhindert Clipping am Modal-Rand)
              const anchorRight = idx >= Math.floor(SLOT_ORDER.length * 0.6);

              return (
                <div key={s.key} style={{ position: "relative" }}>
                  <button
                    onClick={() => setOpenSlot(isOpen ? null : s.key)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: "6px 8px 7px",
                      borderRadius: 10,
                      background: empty ? "rgba(255,255,255,0.03)" : `linear-gradient(180deg, ${tierColor}22 0%, rgba(0,0,0,0.4) 100%)`,
                      border: `1.5px solid ${empty ? "rgba(255,255,255,0.1)" : tierColor}`,
                      boxShadow: empty ? "none" : `0 0 10px ${tierColor}33`,
                      cursor: busy ? "wait" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                        background: empty ? "rgba(0,0,0,0.3)" : `${tierColor}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, opacity: empty ? 0.5 : 1,
                      }}>{eq ? eq.emoji : s.icon}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: 1, color: "#8B8FA3" }}>
                          {t(s.labelKey).toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 900, color: empty ? "#6c7590" : tierColor,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {eq ? eq.name : t("slotEmpty")}
                        </div>
                      </div>
                    </div>
                    {bonusSummary && (
                      <div style={{
                        marginTop: 3, fontSize: 9, color: "#4ade80", fontWeight: 900,
                        letterSpacing: 0.3, lineHeight: 1.2,
                      }}>
                        {bonusSummary}
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <SlotPicker
                      slotLabel={t(s.labelKey)}
                      available={available}
                      equippedId={eq?.user_item_id ?? null}
                      anchorRight={anchorRight}
                      onPick={equip}
                      onUnequip={eq ? () => unequip(s.key) : null}
                      onClose={() => setOpenSlot(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

const TIER_MULT = [1.0, 1.5, 2.25, 3.5];

function summarizeBonus(it: EquippedItem, tier: number): string | null {
  const m = TIER_MULT[Math.max(0, Math.min(3, tier))];
  const parts: string[] = [];
  if (it.bonus_hp)  parts.push(`+${Math.round(it.bonus_hp  * m)} HP`);
  if (it.bonus_atk) parts.push(`+${Math.round(it.bonus_atk * m)} ATK`);
  if (it.bonus_def) parts.push(`+${Math.round(it.bonus_def * m)} DEF`);
  if (it.bonus_spd) parts.push(`+${Math.round(it.bonus_spd * m)} SPD`);
  return parts.length ? parts.join(" · ") : null;
}

function SlotPicker({ slotLabel, available, equippedId, anchorRight, onPick, onUnequip, onClose }: {
  slotLabel: string;
  available: EquippedItem[];
  equippedId: string | null;
  anchorRight?: boolean;
  onPick: (id: string) => void;
  onUnequip: (() => void) | null;
  onClose: () => void;
}) {
  const t = useTranslations("Arena");
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", zIndex: 51, top: "100%",
        ...(anchorRight ? { right: 0 } : { left: 0 }),
        marginTop: 4,
        width: 240, maxWidth: "min(240px, calc(100vw - 40px))",
        background: "linear-gradient(180deg, #1a1d23 0%, #0f1115 100%)",
        border: "1px solid rgba(255,215,0,0.4)",
        borderRadius: 10,
        boxShadow: "0 10px 40px rgba(0,0,0,0.7), 0 0 20px rgba(255,215,0,0.15)",
        padding: 6, maxHeight: 280, overflowY: "auto",
      }}>
        <div style={{ padding: "4px 6px 6px", color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
          {t("slotPickHeader", { slot: slotLabel.toUpperCase() })}
        </div>
        {available.length === 0 ? (
          <div style={{ padding: "10px 8px", fontSize: 10, color: "#6c7590", textAlign: "center" }}>
            {t("slotPickEmpty")}
          </div>
        ) : (
          available.map((it) => {
            const tier = it.upgrade_tier;
            const tierColor = TIER_COLORS[Math.max(0, Math.min(3, tier))];
            const isEquipped = it.user_item_id === equippedId;
            const bonus = summarizeBonus(it, tier);
            return (
              <button
                key={it.user_item_id}
                onClick={() => isEquipped ? onClose() : onPick(it.user_item_id)}
                style={{
                  display: "block", width: "100%", padding: "6px 8px",
                  marginTop: 2,
                  background: isEquipped ? `${tierColor}22` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isEquipped ? tierColor : "transparent"}`,
                  borderRadius: 8, cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{it.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: tierColor, fontSize: 11, fontWeight: 900 }}>
                      {it.name}{tier > 0 ? ` T${tier}` : ""}
                    </div>
                    {bonus && (
                      <div style={{ color: "#4ade80", fontSize: 9, fontWeight: 700 }}>
                        {bonus}
                      </div>
                    )}
                  </div>
                  {isEquipped && <span style={{ fontSize: 9, color: tierColor, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })
        )}
        {onUnequip && (
          <button
            onClick={onUnequip}
            style={{
              display: "block", width: "100%", marginTop: 6, padding: "6px 8px",
              background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.3)",
              borderRadius: 8, color: "#FF2D78", fontSize: 10, fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {t("slotUnequip")}
          </button>
        )}
      </div>
    </>
  );
}

function GearStat({ label, value, bonus, icon, color }: { label: string; value: number; bonus: number; icon: string; color: string }) {
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  return (
    <div style={{
      position: "relative", padding: "6px 8px", borderRadius: 8,
      background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.35) 90%)`,
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1 }}>
        <span>{icon} {label}</span>
        {bonus > 0 && <span style={{ color: "#4ade80", fontSize: 9, fontWeight: 900 }}>+{bonus.toLocaleString(numLocale)}</span>}
      </div>
      <div style={{ color, fontSize: 15, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
        {value.toLocaleString(numLocale)}
      </div>
    </div>
  );
}

function ArenaStatTile({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: string; color: string }) {
  return (
    <div style={{
      position: "relative",
      padding: "10px 12px",
      borderRadius: 12,
      background: `linear-gradient(135deg, ${color}18 0%, rgba(15,17,21,0.6) 70%)`,
      border: `1px solid ${color}44`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px ${color}15`,
    }}>
      <div style={{
        position: "absolute", top: 6, right: 8,
        fontSize: 18, opacity: 0.5,
      }}>{icon}</div>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ color: "#a8b4cf", fontSize: 9, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function OpponentCard({ op, myType, onAttack, busy, disabled }: { op: Opponent; myType: GuardianType | null; onAttack: () => void; busy: boolean; disabled: boolean }) {
  const t = useTranslations("Arena");
  const factionColor = (op.faction === "syndicate" || op.faction === "gossenbund") ? "#22D1C3" : (op.faction === "vanguard" || op.faction === "kronenwacht") ? "#FFD700" : "#8B8FA3";
  const rarityMeta = op.rarity === "legendary"
    ? { color: "#FFD700", label: t("rarityLegendary"), glow: "rgba(255,215,0,0.4)" }
    : op.rarity === "epic"
    ? { color: "#a855f7", label: t("rarityEpic"),      glow: "rgba(168,85,247,0.4)" }
    : { color: "#22D1C3", label: t("rarityElite"),     glow: "rgba(34,209,195,0.3)" };

  const opType = op.guardian_type && (op.guardian_type in TYPE_META) ? TYPE_META[op.guardian_type as GuardianType] : null;
  const mult = myType && op.guardian_type && (op.guardian_type in TYPE_META)
    ? typeCounter(myType, op.guardian_type as GuardianType) : 1;
  const matchup = mult > 1
    ? { label: t("matchupAdvantage"), color: "#4ade80", icon: "✅" }
    : mult < 1
    ? { label: t("matchupDisadvantage"), color: "#FF2D78", icon: "⚠️" }
    : null;

  // S&F-Style Base-Stats (gleiche Formel wie Engine nutzt)
  const base = estimateStats(op.archetype_emoji, op.level, op.rarity);

  return (
    <div style={{
      position: "relative",
      borderRadius: 14,
      background: `linear-gradient(180deg, ${rarityMeta.glow} 0%, #0F1115 60%)`,
      border: `2px solid ${rarityMeta.color}`,
      boxShadow: `0 4px 24px ${rarityMeta.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      overflow: "hidden",
      opacity: disabled && !busy ? 0.5 : 1,
      transition: "transform 0.15s ease",
    }}
    onMouseOver={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(-3px)"; }}
    onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Rarity-Badge oben rechts */}
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 2,
        padding: "3px 8px", borderRadius: 999,
        background: `${rarityMeta.color}dd`, color: "#0F1115",
        fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
      }}>{rarityMeta.label}</div>

      {op.is_bot && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 2,
          padding: "3px 8px", borderRadius: 999,
          background: "rgba(0,0,0,0.6)", color: "#a8b4cf",
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
        }}>{t("botBadge")}</div>
      )}

      {matchup && (
        <div style={{
          position: "absolute", top: 36, left: 8, zIndex: 2,
          padding: "3px 8px", borderRadius: 999,
          background: `${matchup.color}dd`, color: "#0F1115",
          fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
          boxShadow: `0 2px 8px ${matchup.color}66`,
        }}>{matchup.icon} {matchup.label}</div>
      )}

      {/* Portrait-Bereich: Video > Bild > großer Emoji-Avatar */}
      <div style={{
        height: 140, display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle at 50% 40%, ${rarityMeta.color}33 0%, transparent 70%)`,
        borderBottom: `1px solid ${rarityMeta.color}33`,
        overflow: "hidden",
      }}>
        {op.archetype_video_url ? (
          <video src={op.archetype_video_url} autoPlay loop muted playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: `url(#ma365-chroma-black) drop-shadow(0 4px 8px ${rarityMeta.glow})` }} />
        ) : op.archetype_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={op.archetype_image_url} alt={op.archetype_name}
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: `url(#ma365-chroma-black) drop-shadow(0 4px 8px ${rarityMeta.glow})` }} />
        ) : (
          <div style={{ fontSize: 80, filter: `drop-shadow(0 4px 8px ${rarityMeta.glow})` }}>{op.archetype_emoji}</div>
        )}
      </div>

      {/* Name-Block */}
      <div style={{ padding: "10px 12px 6px", textAlign: "center" }}>
        <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>
          {op.display_name ?? op.username}
        </div>
        <div style={{ color: factionColor, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          [{op.archetype_name}]
        </div>
        {opType && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            marginTop: 6, padding: "3px 10px", borderRadius: 999,
            background: `${opType.color}22`, border: `1px solid ${opType.color}77`,
            color: opType.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
          }}>
            <span style={{ fontSize: 11 }}>{opType.icon}</span>
            {opType.label.toUpperCase()}
          </div>
        )}
      </div>

      {/* Level-Bar (wie S&F) */}
      <div style={{ padding: "0 12px 6px" }}>
        <div style={{
          height: 28, borderRadius: 6,
          background: "linear-gradient(180deg, #2b1010, #0f0505)",
          border: "1px solid #FF2D7855",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#FFF", fontSize: 13, fontWeight: 900, letterSpacing: 1,
          textShadow: "0 1px 2px #000",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
        }}>
          {t("level", { level: op.level })}
        </div>
      </div>

      {/* Stat-Grid (S&F-Style Zeilen) */}
      <div style={{ padding: "4px 12px 8px" }}>
        <StatRow label={t("statStr")} value={base.atk} icon="⚔️" color="#FF6B4A" />
        <StatRow label={t("statDef")} value={base.def} icon="🛡️" color="#60a5fa" />
        <StatRow label={t("statHp")}  value={base.hp}  icon="❤️" color="#4ade80" />
        <StatRow label={t("statSpd")} value={base.spd} icon="💨" color="#FFD700" />
      </div>

      {/* Record */}
      <div style={{
        padding: "6px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", fontSize: 10,
      }}>
        <span style={{ color: "#4ade80", fontWeight: 700 }}>🏆 {t("wins", { count: op.wins })}</span>
        <span style={{ color: "#FF2D78", fontWeight: 700 }}>💀 {t("losses", { count: op.losses })}</span>
      </div>

      {/* Angreifen-Button (groß, rot, wie S&F) */}
      <button
        onClick={onAttack}
        disabled={disabled}
        style={{
          display: "block", width: "100%", padding: "12px 16px",
          border: "none",
          background: busy
            ? "#8B8FA3"
            : "linear-gradient(180deg, #FF2D78 0%, #a80d3c 100%)",
          color: "#FFF",
          fontSize: 14, fontWeight: 900, letterSpacing: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        {busy ? t("fighting") : t("attack")}
      </button>
    </div>
  );
}

function StatRow({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
      fontSize: 11,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a8b4cf" }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ color, fontWeight: 900 }}>{value.toLocaleString(numLocale)}</div>
    </div>
  );
}

/** Groben Stat-Wert aus Level + Rarity schätzen (für Anzeige; echter Kampf nutzt DB-Werte). */
function estimateStats(_emoji: string, level: number, rarity: string) {
  const rarityMult = rarity === "legendary" ? 2.0 : rarity === "epic" ? 1.5 : 1.0;
  const lvlMult = 1 + level * 0.15;
  return {
    hp:  Math.round(120 * rarityMult * lvlMult * 10),
    atk: Math.round( 22 * rarityMult * lvlMult),
    def: Math.round( 18 * rarityMult * lvlMult),
    spd: Math.round( 22 * rarityMult * lvlMult * 0.3),
  };
}

function FightModal({ onClose, opponent, myGuardian, rounds, settle, winner }: {
  onClose: () => void;
  opponent: Opponent;
  myGuardian: MyGuardian | null;
  rounds: RoundEvent[];
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  winner: "A" | "B" | null;
}) {
  const t = useTranslations("Arena");
  const [phase, setPhase] = useState<"fight" | "result">("fight");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2500,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      overflow: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 700,
        background: "#0F1115", borderRadius: 20,
        border: "1px solid rgba(255, 45, 120, 0.4)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(255,45,120,0.2)",
        overflow: "hidden",
      }}>
        {phase === "fight" ? (
          <div style={{ padding: 16 }}>
            <CinematicBattleArena
              sideA={{
                name: t("you"),
                archetype: {
                  id: myGuardian?.archetype_id ?? "-",
                  emoji: myGuardian?.archetype_emoji ?? "🛡️",
                  rarity: (myGuardian?.rarity ?? "elite") as "elite"|"epic"|"legendary",
                  image_url: myGuardian?.archetype_image_url ?? null,
                  video_url: myGuardian?.archetype_video_url ?? null,
                },
                level: myGuardian?.level ?? 1,
                maxHp: 100,
              }}
              sideB={{
                name: opponent.display_name ?? opponent.username ?? t("opponentFallback"),
                archetype: {
                  id: opponent.archetype_id,
                  emoji: opponent.archetype_emoji,
                  rarity: opponent.rarity as "elite"|"epic"|"legendary",
                  image_url: opponent.archetype_image_url ?? null,
                  video_url: opponent.archetype_video_url ?? null,
                },
                level: opponent.level,
                maxHp: 100,
              }}
              rounds={rounds}
              onFinished={() => setPhase("result")}
            />
            <button onClick={() => setPhase("result")} style={{
              marginTop: 12, width: "100%", padding: "8px 16px",
              borderRadius: 10, background: "rgba(255,255,255,0.05)",
              color: "#a8b4cf", fontSize: 12, fontWeight: 700,
              border: "none", cursor: "pointer",
            }}>
              {t("skipFight")}
            </button>
          </div>
        ) : (
          <ResultView onClose={onClose} opponent={opponent} myGuardian={myGuardian} rounds={rounds} settle={settle} winner={winner} />
        )}
      </div>
    </div>
  );
}

function ResultView({ onClose, opponent, myGuardian, rounds, settle, winner }: {
  onClose: () => void;
  opponent: Opponent;
  myGuardian: MyGuardian | null;
  rounds: RoundEvent[];
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  winner: "A" | "B" | null;
}) {
  const t = useTranslations("Arena");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const won = settle?.won ?? winner === "A";
  const rarityMeta = settle?.rarity === "epic" ? { label: t("rarityEpic"), color: "#a855f7" }
                    : settle?.rarity === "rare" ? { label: t("rarityRare"), color: "#22D1C3" }
                    : { label: t("rarityCommon"), color: "#8B8FA3" };

  // Damage-Stats aus den Rounds berechnen
  let dmgA = 0, dmgB = 0, critsA = 0, critsB = 0;
  for (const r of rounds) {
    const dmg = r.damage ?? 0;
    const isCrit = r.action === "crit" || r.action === "ult";
    if (r.actor === "A") { dmgA += dmg; if (isCrit) critsA++; }
    if (r.actor === "B") { dmgB += dmg; if (isCrit) critsB++; }
  }
  const lastRound = rounds[rounds.length - 1];
  const finalHpA = lastRound?.hp_a_after ?? 100;
  const finalHpB = lastRound?.hp_b_after ?? 100;

  const bannerColor = won ? "#4ade80" : "#FF2D78";
  const bannerLabel = won ? t("victory") : t("defeat");
  const bannerIcon = won ? "🏆" : "💀";
  const flavorText = won ? t("victoryFlavor") : t("defeatFlavor");

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Hintergrund: Schiffsplanken-Feeling */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.4,
        background: "linear-gradient(180deg, rgba(139,69,19,0.15) 0%, rgba(15,17,21,0.8) 100%)",
        pointerEvents: "none",
      }} />

      {/* Top-Banner */}
      <div style={{
        position: "relative",
        padding: "20px 16px 14px",
        textAlign: "center",
        background: `linear-gradient(180deg, ${bannerColor}22 0%, transparent 100%)`,
        borderBottom: `2px solid ${bannerColor}`,
      }}>
        <div style={{ fontSize: 48, marginBottom: 4, animation: "victoryPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>{bannerIcon}</div>
        <div style={{
          display: "inline-block",
          padding: "6px 28px",
          background: `linear-gradient(180deg, ${bannerColor} 0%, ${bannerColor}88 100%)`,
          color: won ? "#0F1115" : "#FFF",
          fontSize: 20, fontWeight: 900, letterSpacing: 4,
          borderRadius: 4,
          boxShadow: `0 4px 12px ${bannerColor}55, inset 0 -2px 4px rgba(0,0,0,0.3)`,
          textShadow: won ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
        }}>{bannerLabel}</div>
        <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 10, maxWidth: 480, margin: "10px auto 0" }}>
          {flavorText}
        </div>
      </div>

      {/* Split-Screen: Beide Kämpfer */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, padding: "20px 12px" }}>
        {/* Du */}
        <FighterPanel
          side="left"
          name={t("you")}
          emoji={myGuardian?.archetype_emoji ?? "🛡️"}
          imageUrl={myGuardian?.archetype_image_url ?? null}
          videoUrl={myGuardian?.archetype_video_url ?? null}
          level={myGuardian?.level ?? 1}
          hpPct={finalHpA}
          dmgDealt={dmgA}
          crits={critsA}
          winner={won}
        />

        {/* Schwert-Trenner */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#8B8FA3", fontSize: 32, padding: "0 8px",
          transform: "rotate(-15deg)",
        }}>⚔️</div>

        {/* Gegner */}
        <FighterPanel
          side="right"
          name={opponent.display_name ?? opponent.username ?? t("opponentFallback")}
          emoji={opponent.archetype_emoji}
          imageUrl={opponent.archetype_image_url ?? null}
          videoUrl={opponent.archetype_video_url ?? null}
          level={opponent.level}
          hpPct={finalHpB}
          dmgDealt={dmgB}
          crits={critsB}
          winner={!won}
        />
      </div>

      {/* Beute-Box (nur bei Sieg) */}
      {settle && (
        <div style={{
          position: "relative", margin: "0 20px 16px",
          padding: 14, borderRadius: 12,
          background: `linear-gradient(135deg, ${rarityMeta.color}22 0%, transparent 70%)`,
          border: `1px solid ${rarityMeta.color}55`,
        }}>
          <div style={{ color: rarityMeta.color, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>
            {t("rewardsHeader")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <RewardTile icon="⚡" label={t("rewardXp")} value={`+${settle.xp.toLocaleString(numLocale)}`} color="#FFD700" />
            <RewardTile icon="🔖" label={t("rewardSeal", { type: settle.siegel_type })} value="+1" color={rarityMeta.color} />
            {settle.item_id && (
              <div style={{ gridColumn: "1 / -1" }}>
                <RewardTile icon="🎁" label={t("rewardLoot")} value={t("rewardLootValue")} color="#FFD700" />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "relative", padding: "0 20px 20px", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
        <button onClick={onClose} style={{
          padding: "14px 12px", borderRadius: 10,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#a8b4cf", fontSize: 13, fontWeight: 800, letterSpacing: 1,
          cursor: "pointer",
        }}>
          {t("backToArena")}
        </button>
        <button onClick={onClose} style={{
          padding: "14px 16px", borderRadius: 10,
          background: "linear-gradient(180deg, #22D1C3 0%, #0f8178 100%)",
          color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 1.5,
          border: "none", cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)",
        }}>
          {t("fightAgain")}
        </button>
      </div>

      <style>{`
        @keyframes victoryPop {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(4deg); }
          100% { transform: scale(1)   rotate(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function FighterPanel({ side, name, emoji, imageUrl, videoUrl, level, hpPct, dmgDealt, crits, winner }: {
  side: "left" | "right";
  name: string;
  emoji: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  level: number;
  hpPct: number;
  dmgDealt: number;
  crits: number;
  winner: boolean;
}) {
  const t = useTranslations("Arena");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const color = winner ? "#4ade80" : "#FF2D78";
  return (
    <div style={{
      position: "relative", padding: 10,
      borderRadius: 12,
      background: winner ? `${color}08` : "rgba(255,45,120,0.04)",
      border: `1px solid ${color}44`,
      textAlign: side === "left" ? "left" : "right",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: side === "right" ? "row-reverse" : "row" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: `radial-gradient(circle, ${color}22 0%, #0F1115 80%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, flexShrink: 0,
          border: `1px solid ${color}66`,
          overflow: "hidden",
        }}>
          {videoUrl ? (
            <video src={videoUrl} autoPlay loop muted playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
          ) : imageUrl ? (
            <img src={imageUrl} alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
          ) : emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>{name}</div>
          <div style={{ color: "#a8b4cf", fontSize: 10 }}>{t("level", { level })}</div>
        </div>
      </div>

      {/* HP-Bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#a8b4cf", marginBottom: 2 }}>
          <span>{t("hpLabel")}</span>
          <span style={{ color: hpPct > 50 ? "#4ade80" : hpPct > 20 ? "#FFD700" : "#FF2D78", fontWeight: 900 }}>
            {Math.round(hpPct)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(0,0,0,0.5)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, hpPct))}%`,
            background: hpPct > 50 ? "linear-gradient(90deg, #4ade80, #22c55e)" : hpPct > 20 ? "linear-gradient(90deg, #FFD700, #f59e0b)" : "linear-gradient(90deg, #FF2D78, #dc2626)",
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      {/* Damage-Stats */}
      <div style={{ marginTop: 8, fontSize: 10, color: "#a8b4cf" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("damage")}</span>
          <span style={{ color: "#FF6B4A", fontWeight: 900 }}>{dmgDealt.toLocaleString(numLocale)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span>{t("crits")}</span>
          <span style={{ color: "#FFD700", fontWeight: 900 }}>{crits}</span>
        </div>
      </div>
    </div>
  );
}


function RewardTile({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      background: "rgba(0,0,0,0.3)", border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#a8b4cf", fontSize: 9, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ color, fontSize: 15, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

/* ═══ Season Picker (Saison-Wächter wählen) ═══ */
type Archetype = { id: string; name: string; emoji: string; image_url?: string | null; video_url?: string | null; rarity: string; guardian_type: string | null; role: string | null; ability_name: string; ability_desc: string };

const DEMO_ARCHETYPES: Archetype[] = [
  { id: "d1", name: "Nyx die Schattenklinge", emoji: "🗡️", rarity: "legendary", guardian_type: "cavalry",  role: "Assassin",  ability_name: "Schattenstoß",  ability_desc: "Erster Angriff trifft doppelt." },
  { id: "d2", name: "Titan der Unbezwingbare", emoji: "🛡️", rarity: "epic",      guardian_type: "infantry", role: "Tank",      ability_name: "Mauer",          ability_desc: "Halbiert erlittenen Schaden in Runde 1." },
  { id: "d3", name: "Zephyr der Schütze",     emoji: "🏹", rarity: "epic",      guardian_type: "marksman", role: "Sniper",    ability_name: "Durchschuss",    ability_desc: "Ignoriert 30% der gegnerischen Verteidigung." },
  { id: "d4", name: "Ember die Flamme",       emoji: "🔥", rarity: "legendary", guardian_type: "mage",     role: "Burst",     ability_name: "Feuersbrunst",   ability_desc: "Brennt den Gegner über 3 Runden." },
  { id: "d5", name: "Kael der Wachhund",      emoji: "🐺", rarity: "elite",     guardian_type: "infantry", role: "Bruiser",   ability_name: "Bissfest",       ability_desc: "Heilt pro Treffer 8% HP." },
  { id: "d6", name: "Shade die Listige",      emoji: "🌙", rarity: "elite",     guardian_type: "cavalry",  role: "Duelist",   ability_name: "Ausweichen",     ability_desc: "25% Chance Angriff zu kontern." },
];

function SeasonPicker({ season, eternal, onPicked, onClose, demoMode }: {
  season: { id: string; number: number; name: string; ends_at: string };
  eternal: { id: string; guardian_archetypes: { name: string; emoji: string } } | null;
  onPicked: () => void;
  onClose?: () => void;
  demoMode?: boolean;
}) {
  const t = useTranslations("Arena");
  const [archetypes, setArchetypes] = useState<Archetype[] | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    if (demoMode) { setArchetypes(DEMO_ARCHETYPES); return; }
    void fetch("/api/arena/season/pick", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setArchetypes(j.archetypes ?? []));
  }, [demoMode]);

  async function pick(archetypeId: string) {
    if (demoMode) {
      const a = DEMO_ARCHETYPES.find((x) => x.id === archetypeId);
      await appAlert({
        title: t("demoModeAlertTitle"),
        message: t("demoModeAlertMessage", { name: a?.name ?? t("pickGuardianFallback") }),
        icon: a?.emoji ?? "⚔️",
      });
      onPicked();
      return;
    }
    const a = archetypes?.find((x) => x.id === archetypeId);
    const ok = await appConfirm({
      title: t("pickConfirmTitle"),
      message: t("pickConfirmMessage", { name: a?.name ?? t("pickGuardianFallback") }),
      confirmLabel: t("pickConfirmYes"),
      cancelLabel: t("pickConfirmNo"),
      icon: a?.emoji ?? "⚔️",
    });
    if (!ok) return;
    setPickingId(archetypeId);
    const res = await fetch("/api/arena/season/pick", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ archetype_id: archetypeId }),
    });
    const j = await res.json() as { ok: boolean; error?: string };
    if (!j.ok) { await appAlert({ title: t("errorTitle"), message: j.error ?? t("unknownError"), icon: "⚠️" }); setPickingId(null); return; }
    onPicked();
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div style={{
      padding: 20, borderRadius: 16,
      background: "radial-gradient(ellipse at top, rgba(255,215,0,0.14) 0%, transparent 60%), linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)",
      border: "1px solid rgba(255,215,0,0.4)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.15)",
    }}>
      {onClose && (
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
          width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 18,
        }}>✕</button>
      )}

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        {demoMode && (
          <div style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 999,
            background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.5)",
            color: "#c084fc", fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 8,
          }}>{t("demoModeBadge")}</div>
        )}
        <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 3 }}>
          {t("seasonHeader", { number: season.number, name: season.name.toUpperCase() })}
        </div>
        <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>
          {t("seasonPickTitle")}
        </div>
        <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 6, maxWidth: 540, margin: "6px auto 0" }}>
          {t.rich("seasonPickIntro", {
            days: daysLeft,
            a: (c) => <b style={{ color: "#22D1C3" }}>{c}</b>,
            b: (c) => <b style={{ color: "#FFD700" }}>{c}</b>,
            c: (c) => <b>{c}</b>,
          })}
        </div>
        <button
          onClick={() => setShowExplainer((v) => !v)}
          style={{
            marginTop: 10, padding: "5px 12px", borderRadius: 999,
            background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.35)",
            color: "#22D1C3", fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}
        >{showExplainer ? t("showLess") : t("showHowItWorks")}</button>
      </div>

      {showExplainer && <GuardianExplainer />}

      {eternal && (
        <div style={{
          margin: "0 auto 16px", maxWidth: 420, padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 26 }}>{eternal.guardian_archetypes.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{t("eternalGuardianLabel")}</div>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 700 }}>{eternal.guardian_archetypes.name}</div>
          </div>
          <span style={{ color: "#a8b4cf", fontSize: 10 }}>{t("eternalInheritsLoot")}</span>
        </div>
      )}

      {!archetypes ? (
        <div className="p-10 text-center text-[#8B8FA3]">{t("loadingGuardians")}</div>
      ) : archetypes.length === 0 ? (
        <div className="p-8 text-center text-[#8B8FA3] text-sm">
          {t("noGuardiansAvailable")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {archetypes.map((a) => {
            const rarityColor = a.rarity === "legendary" ? "#FFD700" : a.rarity === "epic" ? "#a855f7" : "#22D1C3";
            const busy = pickingId === a.id;
            return (
              <button key={a.id} onClick={() => pick(a.id)} disabled={!!pickingId}
                style={{
                  padding: 12, borderRadius: 12, textAlign: "left", cursor: pickingId ? "wait" : "pointer",
                  background: `radial-gradient(circle at 50% 0%, ${rarityColor}22 0%, transparent 70%), rgba(15,17,21,0.8)`,
                  border: `1.5px solid ${rarityColor}66`,
                  opacity: pickingId && !busy ? 0.4 : 1,
                }}>
                <div style={{
                  width: 88, height: 88, margin: "0 auto",
                  borderRadius: 12, overflow: "hidden",
                  background: `radial-gradient(circle, ${rarityColor}22 0%, transparent 80%)`,
                  border: `1px solid ${rarityColor}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 48, filter: `drop-shadow(0 4px 8px ${rarityColor}66)`,
                }}>
                  {a.video_url ? (
                    <video src={a.video_url} autoPlay loop muted playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
                  ) : a.image_url ? (
                    <img src={a.image_url} alt={a.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
                  ) : a.emoji}
                </div>
                <div style={{ color: rarityColor, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, marginTop: 4, textAlign: "center" }}>
                  {a.rarity === "legendary" ? t("rarityLegendary") : a.rarity === "epic" ? t("rarityEpic") : t("rarityElite")}
                </div>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, marginTop: 2, textAlign: "center" }}>
                  {a.name}
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 6, textAlign: "center", fontStyle: "italic", lineHeight: 1.3 }}>
                  „{a.ability_name}"
                </div>
                <div style={{
                  marginTop: 8, padding: "6px 8px", borderRadius: 6, textAlign: "center",
                  background: busy ? "#8B8FA3" : `linear-gradient(180deg, ${rarityColor} 0%, ${rarityColor}aa 100%)`,
                  color: "#0F1115", fontSize: 10, fontWeight: 900, letterSpacing: 1.2,
                }}>
                  {busy ? t("picking") : t("pickButton")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ Erklär-Komponenten: „Warum 2 Wächter?" ═══ */

function GuardianExplainerButton() {
  const t = useTranslations("Arena");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.35)", color: "#22D1C3",
        }}
      >{t("twoGuardiansButton")}</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto",
              background: "linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)",
              border: "1px solid rgba(255,215,0,0.4)", borderRadius: 16, padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>{t("twoGuardiansTitle")}</div>
              <button onClick={() => setOpen(false)} style={{
                background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
                width: 30, height: 30, borderRadius: 999, cursor: "pointer", fontSize: 16,
              }}>✕</button>
            </div>
            <GuardianExplainer />
          </div>
        </div>
      )}
    </>
  );
}

function GuardianExplainer() {
  const t = useTranslations("Arena");
  const richB = { b: (c: React.ReactNode) => <b>{c}</b> };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 auto 18px", maxWidth: 540 }}>
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.25)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 6 }}>{t("explainerWhyTwo")}</div>
        <div style={{ fontSize: 13, color: "#dde3f5", lineHeight: 1.55 }}>
          {t.rich("explainerWhyTwoBody", richB)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{
          padding: 12, borderRadius: 12,
          background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.3)",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🛡️</div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700" }}>{t("explainerEternalLabel")}</div>
          <div style={{ fontSize: 12, color: "#dde3f5", marginTop: 4, lineHeight: 1.5 }}>
            {t.rich("explainerEternalBody", { b: (c) => <b>{c}</b>, c: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 12,
          background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.3)",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>⚔️</div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#22D1C3" }}>{t("explainerSeasonalLabel")}</div>
          <div style={{ fontSize: 12, color: "#dde3f5", marginTop: 4, lineHeight: 1.5 }}>
            {t.rich("explainerSeasonalBody", richB)}
          </div>
        </div>
      </div>

      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#FFD700", marginBottom: 8 }}>{t("explainerHowItWorks")}</div>
        <Step num="1" title={t("stepSeasonStartTitle")}>
          {t("stepSeasonStartBody")}
        </Step>
        <Step num="2" title={t("stepFightLootTitle")}>
          {t.rich("stepFightLootBody", { b: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}
        </Step>
        <Step num="3" title={t("stepSeasonEndTitle")}>
          {t("stepSeasonEndBody")}
        </Step>
        <Step num="4" title={t("stepNewSeasonTitle")} last>
          {t("stepNewSeasonBody")}
        </Step>
      </div>

      <div style={{
        padding: 10, borderRadius: 10,
        background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)",
        color: "#c084fc", fontSize: 11, lineHeight: 1.5,
      }}>
        {t.rich("explainerImportant", richB)}
      </div>
    </div>
  );
}

/* ═══ Potion-Button im ArenaHeader ═══ */
function PotionButton() {
  const t = useTranslations("Arena");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("potionsLabel")}
        style={{
          background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)",
          color: "#a855f7", height: 34, borderRadius: 999, padding: "0 12px",
          cursor: "pointer", fontSize: 13, fontWeight: 800,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >🧪 <span>{t("potionsLabel")}</span></button>
      {open && <PotionInventoryModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ═══ Prestige-Demo: XP → Level → Saisonende → Prestige ═══ */

function PrestigeDemoButton() {
  const t = useTranslations("Arena");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700",
        }}
      >{t("prestigeButton")}</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560, width: "100%", maxHeight: "92vh", overflowY: "auto",
              background: "linear-gradient(180deg, #13161e 0%, #0a0a0f 100%)",
              border: "1px solid rgba(255,215,0,0.4)", borderRadius: 16, padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>{t("prestigeButton")}</div>
              <button onClick={() => setOpen(false)} style={{
                background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
                width: 30, height: 30, borderRadius: 999, cursor: "pointer", fontSize: 16,
              }}>✕</button>
            </div>
            <PrestigeDemo />
          </div>
        </div>
      )}
    </>
  );
}

// Stark vereinfachte Kurve für die Demo — in Realität siehe guardian.ts
const DEMO_XP_CURVE = [0, 100, 250, 500, 900, 1500, 2300, 3300, 4500, 6000, 8000];
const DEMO_LEVEL_CAP = 10;

function PrestigeDemo() {
  const t = useTranslations("Arena");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [xp, setXp] = useState(0);
  const [wins, setWins] = useState(0);
  const [endedSeasons, setEndedSeasons] = useState(0);
  const [prestige, setPrestige] = useState(0);
  const [title, setTitle] = useState<string | null>(null);

  // Level aus XP ableiten
  let level = 1;
  for (let i = 1; i < DEMO_XP_CURVE.length; i++) {
    if (xp >= DEMO_XP_CURVE[i]) level = i + 1;
  }
  const nextThreshold = DEMO_XP_CURVE[Math.min(level, DEMO_XP_CURVE.length - 1)];
  const prevThreshold = DEMO_XP_CURVE[level - 1] ?? 0;
  const progressPct = level >= DEMO_LEVEL_CAP
    ? 100
    : Math.round(((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100);

  function doFight(win: boolean) {
    const xpGain = win ? 80 : 20;
    setXp((v) => v + xpGain);
    if (win) setWins((w) => w + 1);
  }

  function endSeason() {
    // Mini-Prestige-Formel für die Demo: Level*10 + Wins*3
    const earned = level * 10 + wins * 3;
    const newTotal = prestige + earned;
    setPrestige(newTotal);
    setEndedSeasons((n) => n + 1);
    // Titel-Zuteilung
    let newTitle: string | null = null;
    if (wins >= 10 && level >= 8) newTitle = t("titleWarmaster");
    else if (wins >= 5 || level >= 6) newTitle = t("titleGladiator");
    else if (wins >= 1) newTitle = t("titleVeteran");
    setTitle(newTitle);
    // Saison-Wächter reset
    setXp(0);
    setWins(0);
  }

  function reset() {
    setXp(0); setWins(0); setPrestige(0); setEndedSeasons(0); setTitle(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, color: "#a8b4cf", lineHeight: 1.55 }}>
        {t.rich("prestigeIntro", { b: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}
      </div>

      {/* Saison-Wächter Panel */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(34,209,195,0.05)", border: "1px solid rgba(34,209,195,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#22D1C3" }}>
            {t("prestigeSeasonalLabel", { number: endedSeasons + 1 })}
          </div>
          <div style={{ fontSize: 11, color: "#a8b4cf" }}>{t("prestigeWinsLabel")} <b style={{ color: "#FFF" }}>{wins}</b></div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#FFF" }}>{t("prestigeLevelShort", { level })}</div>
          <div style={{ fontSize: 12, color: "#a8b4cf" }}>
            {xp.toLocaleString(numLocale)} XP
            {level < DEMO_LEVEL_CAP && <> / {nextThreshold.toLocaleString(numLocale)}</>}
            {level >= DEMO_LEVEL_CAP && <span style={{ color: "#FFD700" }}>{t("prestigeMaxBadge")}</span>}
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${Math.min(100, Math.max(0, progressPct))}%`,
            background: "linear-gradient(90deg, #22D1C3, #FFD700)",
            transition: "width 300ms ease",
          }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => doFight(true)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: "pointer",
            background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.5)", color: "#4ade80",
          }}>{t("prestigeWinButton")}</button>
          <button onClick={() => doFight(false)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: "pointer",
            background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.4)", color: "#FF2D78",
          }}>{t("prestigeLossButton")}</button>
        </div>
      </div>

      {/* Account-Prestige Panel */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#FFD700" }}>{t("prestigeAccountLabel")}</div>
            <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 2 }}>{t("prestigeAccountSub")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#FFD700", lineHeight: 1 }}>{prestige}</div>
            <div style={{ fontSize: 10, color: "#a8b4cf" }}>
              {endedSeasons === 1
                ? t("prestigeSeasonsCountOne", { count: endedSeasons })
                : t("prestigeSeasonsCountMany", { count: endedSeasons })}
            </div>
          </div>
        </div>
        {title && (
          <div style={{
            marginTop: 4, padding: "6px 10px", borderRadius: 8,
            background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)",
            color: "#c084fc", fontSize: 11, fontWeight: 800, textAlign: "center",
          }}>{t("prestigeTitleBadge", { title })}</div>
        )}
        <button
          onClick={endSeason}
          disabled={xp === 0 && wins === 0}
          style={{
            width: "100%", marginTop: 10, padding: "9px 12px", borderRadius: 10,
            fontSize: 12, fontWeight: 900, letterSpacing: 1, cursor: xp === 0 && wins === 0 ? "default" : "pointer",
            background: xp === 0 && wins === 0
              ? "rgba(255,255,255,0.04)"
              : "linear-gradient(135deg, #FFD700 0%, #FF6B4A 100%)",
            color: xp === 0 && wins === 0 ? "#6c7590" : "#0F1115",
            border: "none",
            opacity: xp === 0 && wins === 0 ? 0.5 : 1,
          }}
        >{t("prestigeEndButton", { prestige: level * 10 + wins * 3 })}</button>
        <div style={{ fontSize: 10, color: "#6c7590", marginTop: 6, textAlign: "center" }}>
          {t("prestigeFormulaHint")}
        </div>
      </div>

      <div style={{
        padding: 12, borderRadius: 10,
        background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)",
        fontSize: 11, color: "#c8bbe6", lineHeight: 1.5,
      }}>
        {t.rich("prestigeAfterSeason", { b: (c) => <b>{c}</b> })}
      </div>

      <button onClick={reset} style={{
        padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
        background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#a8b4cf",
      }}>{t("prestigeReset")}</button>
    </div>
  );
}

function Step({ num, title, children, last }: { num: string; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 10, paddingBottom: last ? 0 : 10,
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
      marginBottom: last ? 0 : 10,
    }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: 999,
        background: "linear-gradient(135deg, #22D1C3, #FFD700)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: "#0F1115",
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{title}</div>
        <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

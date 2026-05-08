"use client";

import { useEffect, useState } from "react";
import { UiIcon, useUiIconArt } from "@/components/resource-icon";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const SILVER = "#C0C8D0";
const BRONZE = "#CD7F32";

type Tier = "bronze" | "silver" | "gold";

type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  tier: Tier;
  xp_reward: number;
  unlocked: boolean;
  unlocked_at: string | null;
};

const TIER_META: Record<Tier, { label: string; color: string; ring: string; emoji: string; explainer: string }> = {
  bronze: {
    label: "Bronze",
    color: BRONZE,
    ring: "rgba(205,127,50,0.55)",
    emoji: "🏆",
    explainer: "Bronze-Trophäen sind Onboarding-Meilensteine. Jeder neue Spieler erreicht sie früh — sie führen dich durch die wichtigsten Mechaniken.",
  },
  silver: {
    label: "Silber",
    color: SILVER,
    ring: "rgba(192,200,208,0.55)",
    emoji: "🏆",
    explainer: "Silber-Trophäen erfordern echtes Engagement: 10er- oder 30er-Schwellen, mittlere Spielzeit. Wer Silber sammelt, hat sich eingespielt.",
  },
  gold: {
    label: "Gold",
    color: GOLD,
    ring: "rgba(255,215,0,0.55)",
    emoji: "🏆",
    explainer: "Gold-Trophäen sind die echten Endgame-Meilensteine: Ära-Sieg, CvC-Champion, Hall of Fame. Sie werden nur von wenigen erreicht.",
  },
};

/**
 * Achievement-Übersicht. Geöffnet über Klick auf einen Pokal im Profil-Banner.
 * Zeigt 3-Tier-Tabs (Bronze/Silber/Gold), erklärt das System und listet alle
 * Achievements der jeweiligen Stufe inkl. Freischalt-Status.
 */
export function AchievementsModal({
  open, onClose, initialTier = "bronze",
}: {
  open: boolean;
  onClose: () => void;
  initialTier?: Tier;
}) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uiIconArt = useUiIconArt();

  useEffect(() => { if (open) setTier(initialTier); }, [open, initialTier]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null); setItems(null);
    void (async () => {
      try {
        const r = await fetch("/api/me/achievements", { cache: "no-store" });
        const j = await r.json() as { achievements?: Achievement[]; error?: string };
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error ?? "Fehler beim Laden");
        setItems(j.achievements ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const filtered = items?.filter((a) => a.tier === tier) ?? [];
  const counts = {
    bronze: items?.filter((a) => a.tier === "bronze" && a.unlocked).length ?? 0,
    silver: items?.filter((a) => a.tier === "silver" && a.unlocked).length ?? 0,
    gold:   items?.filter((a) => a.tier === "gold"   && a.unlocked).length ?? 0,
  };
  const totals = {
    bronze: items?.filter((a) => a.tier === "bronze").length ?? 0,
    silver: items?.filter((a) => a.tier === "silver").length ?? 0,
    gold:   items?.filter((a) => a.tier === "gold").length ?? 0,
  };
  const meta = TIER_META[tier];

  return (
    <Modal open={open} onClose={onClose} size="md" zIndex={Z.modalDeep}>
      <ModalHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <UiIcon slot={`trophy_${tier}`} fallback="🏆" art={uiIconArt} size={22} />
            TROPHÄEN
          </span>
        }
        onClose={onClose}
        accent="gold"
      />
      <ModalBody padding="flush">
        {/* Tabs */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {(["bronze", "silver", "gold"] as Tier[]).map((t) => {
            const m = TIER_META[t];
            const active = t === tier;
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  padding: "10px 8px",
                  background: active ? `${m.color}1f` : "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${m.color}` : "2px solid transparent",
                  color: active ? m.color : "#8B8FA3",
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.6,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", filter: active ? `drop-shadow(0 0 4px ${m.ring})` : "grayscale(0.3)" }}>
                    <UiIcon slot={`trophy_${t}`} fallback="🏆" art={uiIconArt} size={18} />
                  </span>
                  {m.label}
                </span>
                <span style={{ fontSize: 10, color: active ? m.color : "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
                  {counts[t]} / {totals[t]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Erklärtext */}
        <div style={{
          padding: "10px 16px",
          background: `${meta.color}0d`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11, color: "rgba(255,255,255,0.78)", lineHeight: 1.5,
        }}>
          {meta.explainer}
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.3)", color: "#FF6B4A", fontSize: 12 }}>
              ❌ {error}
            </div>
          )}
          {!items && !error && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Trophäen…</div>
          )}
          {items && filtered.length === 0 && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>
              Keine Trophäen in dieser Stufe.
            </div>
          )}
          {items && filtered.map((a) => (
            <AchievementRow key={a.id} achievement={a} />
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}

function AchievementRow({ achievement: a }: { achievement: Achievement }) {
  const meta = TIER_META[a.tier];
  const accent = a.unlocked ? meta.color : "rgba(255,255,255,0.1)";
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: a.unlocked
        ? `linear-gradient(135deg, ${meta.color}1a, ${meta.color}05)`
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent}`,
      opacity: a.unlocked ? 1 : 0.55,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: a.unlocked ? `${meta.color}22` : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${accent}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
        filter: a.unlocked ? `drop-shadow(0 0 4px ${meta.ring})` : "grayscale(1)",
        flexShrink: 0,
      }}>
        {a.icon ?? "🏅"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: a.unlocked ? "#FFF" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.name}
          </span>
          <span style={{ fontSize: 9, color: meta.color, fontWeight: 800, letterSpacing: 0.6, flexShrink: 0 }}>
            +{a.xp_reward.toLocaleString("de-DE")} Ansehen
          </span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2, lineHeight: 1.4 }}>
          {a.description}
        </div>
        {a.unlocked && a.unlocked_at && (
          <div style={{ fontSize: 9, color: meta.color, marginTop: 3, fontWeight: 700, letterSpacing: 0.4 }}>
            ✓ FREIGESCHALTET · {new Date(a.unlocked_at).toLocaleDateString("de-DE")}
          </div>
        )}
      </div>
    </div>
  );
}

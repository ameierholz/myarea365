"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  rarityMeta, TYPE_META, statsAtLevel,
  type GuardianArchetype,
} from "@/lib/guardian";
import { CREW_FACTIONS, type CrewFactionId } from "@/lib/crew-factions";
import { useRankArt, RankBadge, rankIdByXp, rankColorById } from "@/components/rank-badge";
import { RUNNER_RANKS } from "@/lib/game-config";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";
const BG_DEEP = "#0F1115";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type RunnerProfileData = {
  username: string | null;
  display_name: string | null;
  faction: string | null;
  team_color: string | null;
  supporter_tier: "bronze" | "silver" | "gold" | null;
  xp: number;
  level: number | null;
  total_distance_m: number;
  total_walks: number;
  total_calories: number;
  longest_run_m: number;
  territory_count: number;
  banner_url: string | null;
  banner_status: "pending" | "approved" | "rejected" | null;
  avatar_url: string | null;
  avatar_status: "pending" | "approved" | "rejected" | null;
  media_rejection_reason: string | null;
  is_owner: boolean;
  crew?: {
    id: string; name: string; color: string | null; role: string | null;
    custom_banner_url: string | null; custom_logo_url: string | null;
    member_count: number | null; zip: string | null; created_at: string | null;
    crew_faction: CrewFactionId | null;
  } | null;
  active_guardian?: {
    id: string; custom_name: string | null; level: number;
    xp: number; wins: number; losses: number;
    talent_points_available: number;
    archetype: GuardianArchetype;
  } | null;
  collection_size: number;
  collection_total: number;
};

type ArenaTitle = { id: string; rank: number; title: string; awarded_at: string; arena_sessions: { name: string } };

export function RunnerStatsModal({ userId, onClose, canEditBanner = false }: { userId: string; onClose: () => void; canEditBanner?: boolean }) {
  const tRS = useTranslations("RunnerStats");
  const rankArt = useRankArt();
  const [data, setData] = useState<RunnerProfileData | null>(null);
  const [titles, setTitles] = useState<ArenaTitle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);

  const reload = async () => {
    const res = await fetch(`/api/runner/profile/${userId}`);
    if (!res.ok) { setError("Profil konnte nicht geladen werden"); return; }
    setData(await res.json() as RunnerProfileData);
  };
  useEffect(() => { reload(); }, [userId]);
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/arena/session?for_user_id=${userId}`);
        if (r.ok) {
          const j = await r.json() as { titles?: ArenaTitle[] };
          setTitles(j.titles ?? []);
        }
      } catch { /* stumm */ }
    })();
  }, [userId]);

  async function onBannerFile(file: File) {
    setBannerBusy(true);
    try {
      const { uploadRunnerBanner } = await import("@/lib/banner-upload");
      const r = await uploadRunnerBanner(file);
      if (r.ok) await reload();
    } finally { setBannerBusy(false); }
  }
  async function onBannerRemove() {
    setBannerBusy(true);
    try {
      const { deleteRunnerBanner } = await import("@/lib/banner-upload");
      await deleteRunnerBanner();
      await reload();
    } finally { setBannerBusy(false); }
  }

  const [avatarBusy, setAvatarBusy] = useState(false);
  async function onAvatarFile(file: File) {
    setAvatarBusy(true);
    try {
      const { uploadRunnerAvatar } = await import("@/lib/banner-upload");
      const r = await uploadRunnerAvatar(file);
      if (r.ok) await reload();
    } finally { setAvatarBusy(false); }
  }
  async function onAvatarRemove() {
    setAvatarBusy(true);
    try {
      const { deleteRunnerAvatar } = await import("@/lib/banner-upload");
      await deleteRunnerAvatar();
      await reload();
    } finally { setAvatarBusy(false); }
  }

  const color = data?.crew?.color ?? data?.team_color ?? PRIMARY;
  const kmTotal = data ? (data.total_distance_m / 1000).toFixed(1) : "–";
  const longestKm = data ? (data.longest_run_m / 1000).toFixed(2) : "–";
  const wins = data?.active_guardian?.wins ?? 0;
  const losses = data?.active_guardian?.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const tierBadge = data?.supporter_tier
    ? data.supporter_tier === "gold"   ? { bg: "linear-gradient(135deg,#FFD700,#FF9E2C)", label: "★ GOLD SUPPORTER",   text: BG_DEEP }
    : data.supporter_tier === "silver" ? { bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", label: "★ SILBER SUPPORTER", text: BG_DEEP }
    : { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", label: "★ BRONZE SUPPORTER", text: "#FFF" }
    : null;

  const [showSupporter, setShowSupporter] = useState(false);
  const [buyingSku, setBuyingSku] = useState<string | null>(null);

  async function buySupporterTier(sku: "badge_bronze" | "badge_silver" | "badge_gold") {
    if (buyingSku) return;
    setBuyingSku(sku);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const j = await res.json().catch(() => null) as { url?: string; error?: string } | null;
      if (j?.url) window.location.href = j.url;
      else alert(j?.error ?? "Checkout fehlgeschlagen");
    } catch {
      alert("Netzwerkfehler beim Checkout");
    } finally {
      setBuyingSku(null);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3800,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${color}22 0%, #141a2d 100%)`,
        borderRadius: 22, border: `1px solid ${color}66`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {error ? (
          <div style={{ padding: 30, textAlign: "center", color: PINK }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 40, textAlign: "center", color: TEXT_SOFT }}>{tRS("loading")}</div>
        ) : (
          <div style={{ overflowY: "auto" }}>
            {/* ═══ HERO BAND ═══ */}
            <div style={{
              height: 140, position: "relative",
              background: data.banner_url
                ? `url("${data.banner_url}") center/cover`
                : `linear-gradient(135deg, ${color} 0%, ${color}77 60%, ${color}33 100%)`,
            }}>
              {data.banner_url && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(20,26,45,0.7) 100%)`,
                }} />
              )}
              <button onClick={onClose} style={{
                position: "absolute", top: 12, left: 12,
                width: 34, height: 34, borderRadius: 17,
                background: "rgba(0,0,0,0.55)", border: "none",
                color: "#FFF", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, zIndex: 2,
              }}>×</button>
              {tierBadge && (
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  padding: "4px 10px", borderRadius: 999,
                  background: tierBadge.bg,
                  color: tierBadge.text, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                  display: "flex", alignItems: "center", gap: 4,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 2,
                }}>
                  {tierBadge.label}
                </div>
              )}
              {canEditBanner && data.banner_url && data.banner_status !== "approved" && (
                <div style={{
                  position: "absolute", top: 56, right: 14, zIndex: 3,
                  padding: "3px 8px", borderRadius: 999,
                  background: data.banner_status === "pending" ? "#FFD700" : PINK,
                  color: "#0F1115", fontSize: 9, fontWeight: 900, letterSpacing: 0.8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}>
                  {data.banner_status === "pending" ? "⏳ Banner in Prüfung" : "❌ Banner abgelehnt"}
                </div>
              )}
              {canEditBanner && (
                <div style={{
                  position: "absolute", bottom: 10, right: 12, zIndex: 2,
                  display: "flex", gap: 6,
                }}>
                  <label style={{
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(0,0,0,0.6)", color: "#FFF",
                    fontSize: 10, fontWeight: 900, cursor: bannerBusy ? "default" : "pointer",
                    border: `1px solid ${color}88`,
                  }}>
                    {bannerBusy ? "…" : data.banner_url ? "🖼️ Banner ändern" : "🖼️ Banner hochladen"}
                    <input type="file" accept="image/*" hidden disabled={bannerBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerFile(f); e.target.value = ""; }} />
                  </label>
                  {data.banner_url && (
                    <button onClick={onBannerRemove} disabled={bannerBusy} style={{
                      padding: "6px 8px", borderRadius: 8,
                      background: "rgba(0,0,0,0.6)", color: PINK,
                      fontSize: 10, fontWeight: 900, cursor: "pointer",
                      border: `1px solid ${PINK}66`,
                    }}>🗑️</button>
                  )}
                </div>
              )}
              {/* Avatar-Puck */}
              <div style={{
                position: "absolute", left: 20, bottom: -36,
                width: 78, height: 78, borderRadius: 20,
                background: data.avatar_url
                  ? `url("${data.avatar_url}") center/cover`
                  : `linear-gradient(135deg, ${color}, ${color}aa)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 42, overflow: "hidden",
                boxShadow: `0 0 0 4px #141a2d, 0 6px 22px ${color}99`,
                zIndex: 3,
              }}>
                {!data.avatar_url && "👣"}
                {canEditBanner && (
                  <label style={{
                    position: "absolute", inset: 0, borderRadius: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: avatarBusy ? "default" : "pointer",
                    background: "rgba(0,0,0,0.55)",
                    opacity: avatarBusy ? 0.8 : 0,
                    transition: "opacity 0.2s",
                    color: "#FFF", fontSize: 10, fontWeight: 900, textAlign: "center",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { if (!avatarBusy) e.currentTarget.style.opacity = "0"; }}
                  >
                    {avatarBusy ? "…" : (data.avatar_url ? "📸 Ändern" : "📸 Foto hoch")}
                    <input type="file" accept="image/*" hidden disabled={avatarBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onAvatarFile(f); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              {/* Avatar-Status-Badge fuer Owner */}
              {canEditBanner && data.avatar_url && data.avatar_status !== "approved" && (
                <div style={{
                  position: "absolute", left: 20, bottom: -52, zIndex: 4,
                  padding: "2px 7px", borderRadius: 999,
                  background: data.avatar_status === "pending" ? "#FFD700" : PINK,
                  color: "#0F1115", fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}>
                  {data.avatar_status === "pending" ? "⏳ IN PRÜFUNG" : "❌ ABGELEHNT"}
                </div>
              )}
            </div>

            <div style={{ padding: "46px 20px 20px" }}>
              {/* Name + Handle */}
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>
                {data.display_name ?? data.username ?? "Runner"}
              </div>
              <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color }}>@{data.username ?? "unknown"}</span>
                {data.level != null && <Dot /> }
                {data.level != null && <span>Lvl {data.level}</span>}
                {data.xp > 0 && <Dot />}
                {data.xp > 0 && <span style={{ color: GOLD, fontWeight: 800 }}>{data.xp.toLocaleString("de-DE")} 🪙</span>}
              </div>

              {/* Rang-Block (Artwork-Medaille + Name) */}
              {data.xp > 0 && (() => {
                const rId = rankIdByXp(data.xp);
                if (!rId) return null;
                const rankRow = RUNNER_RANKS.find((r) => r.id === rId);
                const rColor = rankColorById(rId);
                return (
                  <div style={{
                    marginTop: 12, display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 12,
                    background: `linear-gradient(135deg, ${rColor}1f, ${rColor}08)`,
                    border: `1px solid ${rColor}55`,
                  }}>
                    <RankBadge rankId={rId} color={rColor} size={48} rankArt={rankArt} fallbackEmoji="🏅" showNumberOverlay />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: MUTED, fontSize: 9, fontWeight: 900, letterSpacing: 1.2 }}>RANG</div>
                      <div style={{ color: rColor, fontSize: 15, fontWeight: 900 }}>{rankRow?.name ?? `Rang ${rId}`}</div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ SUPPORTER-CTA ══ */}
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowSupporter((s) => !s)}
                  style={{
                    padding: 0, background: "none", border: "none",
                    color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    textAlign: "left", textDecoration: "underline",
                    textDecorationStyle: "dotted", textUnderlineOffset: 3,
                  }}
                >
                  {showSupporter ? "Pakete ausblenden" : "Du möchtest MyArea auch unterstützen?"}
                </button>
                {showSupporter && (
                  <div style={{ marginTop: 6, color: TEXT_SOFT, fontSize: 10, lineHeight: 1.4 }}>
                    Monats-Abo · jederzeit kündbar · Werbefrei + Badge + Bonus-Skins
                  </div>
                )}
                {showSupporter && (
                  <div style={{
                    marginTop: 8, display: "grid", gap: 8,
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}>
                    {([
                      { sku: "badge_bronze", name: "Bronze", price: "1,99 €/Mon.", icon: "🥉", bg: "linear-gradient(135deg,#CD7F32,#A0522D)", text: "#FFF" },
                      { sku: "badge_silver", name: "Silber", price: "4,99 €/Mon.", icon: "🥈", bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", text: BG_DEEP },
                      { sku: "badge_gold",   name: "Gold",   price: "9,99 €/Mon.", icon: "🥇", bg: "linear-gradient(135deg,#FFD700,#FF9E2C)", text: BG_DEEP },
                    ] as const).map((t) => (
                      <button
                        key={t.sku}
                        onClick={() => buySupporterTier(t.sku)}
                        disabled={buyingSku !== null}
                        style={{
                          padding: "10px 8px", borderRadius: 10, border: "none",
                          background: t.bg, color: t.text, cursor: buyingSku ? "wait" : "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          opacity: buyingSku && buyingSku !== t.sku ? 0.5 : 1,
                          fontWeight: 900,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{t.icon}</span>
                        <span style={{ fontSize: 12 }}>{t.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          {buyingSku === t.sku ? "…" : t.price}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ══ CREW-CARD (mit Banner + Stats) ══ */}
              {data.crew && (() => {
                const cc = data.crew!.color ?? color;
                return (
                  <div style={{
                    marginTop: 14, borderRadius: 16,
                    border: `1px solid ${cc}66`,
                    boxShadow: `0 0 18px ${cc}33`,
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.3)",
                  }}>
                    {/* Crew-Banner */}
                    <div style={{
                      height: 72, position: "relative",
                      background: data.crew.custom_banner_url
                        ? `url("${data.crew.custom_banner_url}") center/cover`
                        : `linear-gradient(135deg, ${cc} 0%, ${cc}77 50%, ${cc}22 100%)`,
                    }}>
                      <div style={{
                        position: "absolute", inset: 0,
                        background: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)`,
                      }} />
                      <div style={{
                        position: "absolute", left: 12, bottom: -22,
                        width: 48, height: 48, borderRadius: 12,
                        background: data.crew.custom_logo_url ? "#0F1115" : cc,
                        border: `2px solid ${cc}`,
                        boxShadow: `0 0 12px ${cc}aa, 0 0 0 3px #141a2d`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, overflow: "hidden",
                      }}>
                        {data.crew.custom_logo_url
                          ? <img src={data.crew.custom_logo_url} alt="Crew-Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : "🏴"}
                      </div>
                      <div style={{
                        position: "absolute", top: 8, right: 10,
                        padding: "3px 8px", borderRadius: 999,
                        background: "rgba(0,0,0,0.55)", color: "#FFF",
                        fontSize: 9, fontWeight: 900, letterSpacing: 1,
                      }}>CREW</div>
                    </div>
                    {/* Crew-Info */}
                    <div style={{ padding: "28px 14px 14px" }}>
                      <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900, lineHeight: 1.15 }}>
                        {data.crew.name}
                      </div>
                      <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {data.crew.zip && <span style={{ padding: "2px 6px", borderRadius: 999, background: `${cc}22`, color: cc, fontWeight: 800 }}>PLZ {data.crew.zip}</span>}
                        {data.crew.created_at && (
                          <span>Gegründet {new Date(data.crew.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginTop: 10 }}>
                        <Stat label="MITGLIEDER" value={data.crew.member_count ?? 0} color={cc} />
                      </div>
                      {data.crew.crew_faction && (() => {
                        const f = CREW_FACTIONS[data.crew.crew_faction];
                        return (
                          <div style={{
                            marginTop: 10, padding: "10px 12px", borderRadius: 12,
                            background: `${f.color}18`, border: `1px solid ${f.color}55`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: 10,
                                background: `${f.color}33`, border: `1px solid ${f.color}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18,
                              }}>{f.icon}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: MUTED, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>FRAKTION</div>
                                <div style={{ color: f.color, fontSize: 13, fontWeight: 900 }}>{f.name}</div>
                              </div>
                              <div style={{
                                padding: "3px 8px", borderRadius: 999,
                                background: f.color, color: "#0F1115",
                                fontSize: 10, fontWeight: 900,
                              }}>{f.buff}</div>
                            </div>
                            <div style={{ color: TEXT_SOFT, fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
                              {f.buffDetail}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}


              {/* ══ AKTIVER WÄCHTER ══ */}
              {data.active_guardian && (() => {
                const g = data.active_guardian!;
                const r = rarityMeta(g.archetype.rarity);
                const typ = g.archetype.guardian_type ? TYPE_META[g.archetype.guardian_type] : null;
                const s = statsAtLevel(g.archetype, g.level);
                return (
                  <div style={{
                    marginTop: 14, padding: 14, borderRadius: 16,
                    background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
                    border: `1px solid ${r.color}77`,
                    boxShadow: `0 0 20px ${r.glow}`,
                  }}>
                    <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
                      ⚡ AKTIVER WÄCHTER
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 120, height: 150, flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>
                        <GuardianAvatar archetype={g.archetype} size={120} animation="idle" fillMode="cover" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                          {r.label.toUpperCase()}{typ ? ` · ${typ.icon} ${typ.label.toUpperCase()}` : ""}
                        </div>
                        <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
                          {g.custom_name ?? g.archetype.name}
                        </div>
                        <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 4 }}>
                          Lvl {g.level} · {wins}W / {losses}L
                          {g.talent_points_available > 0 && (
                            <span style={{ color: GOLD, marginLeft: 6, fontWeight: 900 }}>+{g.talent_points_available} Talent</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 12 }}>
                      <Stat label="HP"  value={s.hp}  color="#4ade80" />
                      <Stat label="ATK" value={s.atk} color="#FF6B4A" />
                      <Stat label="DEF" value={s.def} color="#5ddaf0" />
                      <Stat label="SPD" value={s.spd} color={GOLD} />
                    </div>
                  </div>
                );
              })()}

              {/* ══ KAMPF ══ */}
              <SectionCard title="KAMPF-STATISTIK" color={PINK} icon="⚔️" style={{ marginTop: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  <Stat label="SIEGE"       value={wins}          color="#4ade80" />
                  <Stat label="NIEDERLAGEN" value={losses}        color={PINK} />
                  <Stat label="WIN-RATE"    value={`${winRate}%`} color={GOLD} />
                </div>
              </SectionCard>

              {/* ══ ARENA-TITEL ══ */}
              {titles.length > 0 && (
                <SectionCard title="ARENA-TITEL" color="#FF6B4A" icon="🏆" style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {titles.map((t) => {
                      const color = t.rank === 1 ? "#FFD700" : t.rank === 2 ? "#e8e8e8" : "#cd7f32";
                      return (
                        <div key={t.id} style={{
                          padding: "6px 10px", borderRadius: 999,
                          background: `${color}20`,
                          border: `1px solid ${color}`,
                          color,
                          fontSize: 11, fontWeight: 800,
                        }}>
                          {t.title} · <span style={{ color: MUTED, fontWeight: 600 }}>{t.arena_sessions.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* ══ WALKING ══ */}
              <SectionCard title="WALKING-STATISTIK" color={PRIMARY} icon="🏃" style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <Stat label="GELAUFEN"      value={`${kmTotal} km`}                                 color={PRIMARY} />
                  <Stat label="LÄUFE"         value={data.total_walks}                                color="#a855f7" />
                  <Stat label="KALORIEN"      value={`${data.total_calories.toLocaleString("de-DE")} kcal`} color="#FF6B4A" />
                  <Stat label="LÄNGSTER LAUF" value={`${longestKm} km`}                                color={GOLD} />
                </div>
              </SectionCard>

              {/* ══ FOOTER ══ */}
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FooterStat icon="🗺️" label="GEBIETE" value={data.territory_count} color={PRIMARY} />
                <FooterStat icon="🛡️" label="WÄCHTER-SAMMLUNG" value={`${data.collection_size}/${data.collection_total}`} color="#a855f7" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: "50%", background: MUTED, display: "inline-block" }} />;
}

function SectionCard({ title, color, icon, children, style }: { title: string; color: string; icon: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "rgba(0,0,0,0.3)",
      border: `1px solid ${BORDER}`,
      ...style,
    }}>
      <div style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12 }}>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: "8px 4px", borderRadius: 10,
      background: "rgba(15,17,21,0.65)",
      border: "1px solid rgba(255,255,255,0.05)",
      textAlign: "center",
    }}>
      <div style={{ color: MUTED, fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 14, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function FooterStat({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "rgba(0,0,0,0.3)",
      border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: MUTED, fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

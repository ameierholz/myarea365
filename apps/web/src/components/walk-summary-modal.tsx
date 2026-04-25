"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { XP_REWARDED_AD } from "@/lib/game-config";
import { AD_REWARDS } from "@/lib/monetization";

export type WalkSummary = {
  distance_m: number;
  duration_s: number;
  xp_earned: number;
  streets: string[];
  segment_count: number;
  street_count: number;
  territory_count: number;
  stolen_count?: number;
  bonuses?: {
    streakBonus: number;
    happyHourMult: number;
    boostMult: number;
    crewBoostMult: number;
  };
  newAchievements?: Array<{ id: string; name: string; xp: number; icon: string }>;
  achievementXp?: number;
  /** Zeit-abhängiger Bonus für erneut begangene Abschnitte. */
  reclaim?: { reclaim_count: number; reclaim_xp: number; segments_cooldown: number } | null;
  /** Solo-Läufer: Gebiete sind pending_crew — zeigen Aufforderung zum Crew-Join. */
  pending_territory_count?: number;
  /** Aufschluesselung der Basis-XP vor Multiplikatoren (transparente Anzeige im Modal). */
  breakdown?: {
    walkBase: number;          // XP_PER_WALK (flat)
    kmXp: number;              // XP_PER_KM × km
    segmentsXp: number;        // segments × XP_PER_SEGMENT
    streetsXp: number;         // new streets × XP_PER_STREET_CLAIMED
    territoryXp: number;       // new territories × XP_PER_TERRITORY
    doubleClaimBonus: number;  // extra territory XP wenn Double-Claim-Charge genutzt
    factionClaimBonus?: number; // Gossenbund-Raubzug-Bonus (25 % + 50/Feind)
  };
};

export function WalkSummaryModal({ summary, userId, isPremium, onClose }: {
  summary: WalkSummary;
  userId: string;
  isPremium: boolean;
  onClose: (bonusXp: number) => void;
}) {
  const t = useTranslations("WalkSummary");
  const locale = useLocale();
  const numLocale = locale === "en" ? "en-US" : "de-DE";
  const richTags = { b: (c: React.ReactNode) => <b style={{ color: "#FFD700" }}>{c}</b> } as const;
  const [phase, setPhase] = useState<"checking" | "ad" | "summary">(isPremium ? "summary" : "checking");
  const [progress, setProgress] = useState(0);
  const [bonusXp, setBonusXp] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [adDurationSec] = useState(() => {
    const r = Math.random();
    if (r < 0.35) return 15;
    if (r < 0.75) return 20;
    return 30;
  });
  const sb = createClient();

  useEffect(() => {
    if (phase !== "checking") return;
    (async () => {
      const cooldownMs = AD_REWARDS.post_walk.cooldown_min * 60 * 1000;
      const cutoff = new Date(Date.now() - cooldownMs).toISOString();
      const { data } = await sb.from("ad_views")
        .select("created_at")
        .eq("user_id", userId)
        .eq("placement", "post_walk")
        .eq("completed", true)
        .gte("created_at", cutoff)
        .limit(1);
      setPhase(data && data.length > 0 ? "summary" : "ad");
    })();
  }, [phase, userId, sb]);

  useEffect(() => {
    if (phase !== "ad") return;
    const tick = 100;
    const total = adDurationSec * 1000;
    const int = setInterval(() => {
      setProgress((p) => {
        const next = p + (tick / total) * 100;
        if (next >= 100) {
          clearInterval(int);
          void finishAd();
          return 100;
        }
        return next;
      });
    }, tick);
    return () => clearInterval(int);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finishAd() {
    const xp = XP_REWARDED_AD;
    setBonusXp(xp);
    await sb.from("ad_views").insert({
      user_id: userId, placement: "post_walk", xp_awarded: xp, completed: true,
    });
    const { data: u } = await sb.from("users").select("xp").eq("id", userId).single();
    await sb.from("users").update({ xp: (u?.xp ?? 0) + xp }).eq("id", userId);
    setPhase("summary");
  }

  function skipAd() {
    setSkipped(true);
    setPhase("summary");
  }

  const km = (summary.distance_m / 1000).toFixed(2);
  const mins = Math.floor(summary.duration_s / 60);
  const secs = summary.duration_s % 60;
  const pace = summary.distance_m > 0 ? (summary.duration_s / 60) / (summary.distance_m / 1000) : 0;
  const cal = Math.round(summary.distance_m * 0.06);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#1A1D23", borderRadius: 20, padding: 24,
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#F0F0F0",
      }}>
        {phase === "checking" ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#a8b4cf", fontSize: 13 }}>…</div>
        ) : phase === "ad" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📺</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{t("adTitle")}</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
              {t.rich("adSubtitle", { seconds: adDurationSec, xp: XP_REWARDED_AD, ...richTags })}
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #22D1C3, #FFD700)", transition: "width 0.1s linear" }} />
            </div>
            <div style={{ color: "#22D1C3", fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
              {t("adSecondsLeft", { seconds: Math.ceil((100 - progress) * (adDurationSec / 100)) })}
            </div>
            <button
              onClick={skipAd}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.15)",
                color: "#a8b4cf", padding: "8px 18px", borderRadius: 10,
                fontSize: 11, cursor: "pointer",
              }}
            >
              {t("adSkip")}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>🎉</div>
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>{t("doneTitle")}</div>
              {summary.streets.length > 0 && (
                <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 4 }}>
                  {summary.streets.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14,
            }}>
              <Stat icon="📏" label={t("statDistance")} value={`${km} km`} accent="#22D1C3" />
              <Stat icon="⏱️" label={t("statTime")} value={`${mins}:${String(secs).padStart(2, "0")} min`} accent="#5ddaf0" />
              <Stat icon="⚡" label={t("statPace")} value={pace > 0 ? `${pace.toFixed(1)} ${t("paceUnit")}` : t("paceEmpty")} accent="#FF6B4A" />
              <Stat icon="🔥" label={t("statCalories")} value={`${cal} ${t("calUnit")}`} accent="#FF2D78" />
            </div>

            <div style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(34,209,195,0.1))",
              border: "1px solid rgba(255,215,0,0.4)",
              padding: 14, borderRadius: 14, marginBottom: 16,
            }}>
              <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{t("currencyHeader")}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                <span style={{ color: "#FFD700", fontSize: 28, fontWeight: 900 }}>
                  +{(summary.xp_earned + bonusXp).toLocaleString(numLocale)} 🪙
                </span>
                {bonusXp > 0 && (
                  <span style={{ color: "#22D1C3", fontSize: 11, fontWeight: 800 }}>
                    {t("adBonusInline", { xp: bonusXp })}
                  </span>
                )}
                {skipped && !isPremium && (
                  <span style={{ color: "#a8b4cf", fontSize: 10 }}>{t("skippedInline")}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", fontSize: 11 }}>
                {summary.segment_count > 0 && (
                  <span style={{ color: "#22D1C3" }}>{t("segmentBadge", { count: summary.segment_count })}</span>
                )}
                {summary.street_count > 0 && (
                  <span style={{ color: "#FF6B4A" }}>{t("streetBadge", { count: summary.street_count })}</span>
                )}
                {summary.territory_count > 0 && (
                  <span style={{ color: "#FFD700", fontWeight: 800 }}>{t("territoryBadge", { count: summary.territory_count })}</span>
                )}
                {summary.segment_count === 0 && summary.street_count === 0 && summary.territory_count === 0 && (
                  <span style={{ color: "#a8b4cf" }}>{t("noNewSegments")}</span>
                )}
              </div>

              {/* Aufschluesselung — klappbar */}
              {summary.breakdown && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{
                    cursor: "pointer", listStyle: "none", userSelect: "none",
                    color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  }}>
                    {t("breakdownToggle")}
                  </summary>
                  <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 3, fontSize: 11 }}>
                    {summary.breakdown.walkBase > 0 && (
                      <BreakdownRow icon="✅" label={t("breakdownWalkBase")} value={summary.breakdown.walkBase} numLocale={numLocale} />
                    )}
                    {summary.breakdown.kmXp > 0 && (
                      <BreakdownRow icon="📏" label={t("breakdownDistance", { km })} value={summary.breakdown.kmXp} numLocale={numLocale} />
                    )}
                    {summary.breakdown.segmentsXp > 0 && (
                      <BreakdownRow icon="🛤️" label={t("breakdownSegments", { count: summary.segment_count })} value={summary.breakdown.segmentsXp} numLocale={numLocale} />
                    )}
                    {summary.breakdown.streetsXp > 0 && (
                      <BreakdownRow icon="🛣️" label={t("breakdownStreets", { count: summary.street_count })} value={summary.breakdown.streetsXp} numLocale={numLocale} />
                    )}
                    {summary.breakdown.territoryXp > 0 && (
                      <BreakdownRow icon="🏆" label={t("breakdownTerritories", { count: summary.territory_count })} value={summary.breakdown.territoryXp} numLocale={numLocale} />
                    )}
                    {summary.breakdown.doubleClaimBonus > 0 && (
                      <BreakdownRow icon="🎯" label={t("breakdownDoubleClaim")} value={summary.breakdown.doubleClaimBonus} accent="#FFD700" numLocale={numLocale} />
                    )}
                    {summary.breakdown.factionClaimBonus && summary.breakdown.factionClaimBonus > 0 ? (
                      <BreakdownRow icon="🗝️" label={t("breakdownFactionClaim")} value={summary.breakdown.factionClaimBonus} accent="#22D1C3" numLocale={numLocale} />
                    ) : null}
                    {summary.reclaim && summary.reclaim.reclaim_xp > 0 && (
                      <BreakdownRow icon="♻️" label={t("breakdownReclaim", { count: summary.reclaim.reclaim_count })} value={summary.reclaim.reclaim_xp} accent="#22D1C3" numLocale={numLocale} />
                    )}
                    {summary.bonuses && summary.bonuses.streakBonus > 0 && (
                      <BreakdownRow icon="🔥" label={t("breakdownStreak")} value={summary.bonuses.streakBonus} accent="#FF6B4A" numLocale={numLocale} />
                    )}
                    {summary.bonuses && (summary.bonuses.happyHourMult > 1 || summary.bonuses.boostMult > 1 || summary.bonuses.crewBoostMult > 1) && (
                      <div style={{ padding: "4px 2px 0", borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: 3, color: "#FFD700", fontSize: 10 }}>
                        {t("breakdownMultipliers")}{" "}
                        {summary.bonuses.happyHourMult > 1 && `${t("multHappyHour", { mult: summary.bonuses.happyHourMult })} `}
                        {summary.bonuses.boostMult > 1 && `${t("multBoost", { mult: summary.bonuses.boostMult })} `}
                        {summary.bonuses.crewBoostMult > 1 && `${t("multCrewBoost", { mult: summary.bonuses.crewBoostMult })}`}
                      </div>
                    )}
                    {summary.achievementXp && summary.achievementXp > 0 ? (
                      <BreakdownRow icon="🏅" label={t("breakdownAchievements")} value={summary.achievementXp} accent="#FFD700" numLocale={numLocale} />
                    ) : null}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#FFF" }}>
                      <span>{t("breakdownTotal")}</span>
                      <span style={{ color: "#FFD700" }}>+{(summary.xp_earned + (bonusXp || 0)).toLocaleString(numLocale)} 🪙</span>
                    </div>
                  </div>
                </details>
              )}
              {summary.stolen_count && summary.stolen_count > 0 ? (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)", color: "#FF2D78", fontSize: 11, fontWeight: 800 }}>
                  {t("stolenLabel", { count: summary.stolen_count })}
                </div>
              ) : null}

              {/* Zeit-abhängiger Reclaim-Bonus */}
              {summary.reclaim && (summary.reclaim.reclaim_xp > 0 || summary.reclaim.segments_cooldown > 0) && (
                <div style={{
                  marginTop: 8, padding: 8, borderRadius: 8,
                  background: "rgba(34,209,195,0.12)", border: "1px solid rgba(34,209,195,0.4)",
                  color: "#22D1C3", fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}>
                  {summary.reclaim.reclaim_xp > 0 && (
                    <span>{t("reclaimBonus", { xp: summary.reclaim.reclaim_xp, count: summary.reclaim.reclaim_count })}</span>
                  )}
                  {summary.reclaim.segments_cooldown > 0 && (
                    <span style={{ color: "#8B8FA3", fontWeight: 700 }}>
                      {summary.reclaim.segments_cooldown === 1
                        ? t("cooldownInfoOne", { count: summary.reclaim.segments_cooldown })
                        : t("cooldownInfoMany", { count: summary.reclaim.segments_cooldown })}
                    </span>
                  )}
                </div>
              )}

              {/* Pending-Gebiete (Solo ohne Crew) */}
              {summary.pending_territory_count && summary.pending_territory_count > 0 ? (
                <div style={{
                  marginTop: 8, padding: 10, borderRadius: 8,
                  background: "rgba(255,215,0,0.12)", border: "1px dashed rgba(255,215,0,0.55)",
                  color: "#FFD700", fontSize: 11, fontWeight: 800,
                  lineHeight: 1.45,
                }}>
                  {t.rich("pendingTerritoryHead", { count: summary.pending_territory_count, b: (c) => <b>{c}</b> })}
                  <br />
                  <span style={{ color: "#a8b4cf", fontWeight: 700 }}>
                    {t("pendingTerritoryHint")}
                  </span>
                </div>
              ) : null}
            </div>

            {summary.bonuses && (summary.bonuses.streakBonus > 0 || summary.bonuses.happyHourMult > 1 || summary.bonuses.boostMult > 1 || summary.bonuses.crewBoostMult > 1) && (
              <div style={{
                padding: 12, borderRadius: 12,
                background: "rgba(34,209,195,0.1)",
                border: "1px solid rgba(34,209,195,0.3)",
                marginBottom: 14,
              }}>
                <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
                  {t("bonusActiveHeader")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                  {summary.bonuses.streakBonus > 0 && (
                    <div style={{ color: "#FF6B4A" }}>{t.rich("bonusStreak", { xp: summary.bonuses.streakBonus, b: (c) => <b>{c}</b> })}</div>
                  )}
                  {summary.bonuses.happyHourMult > 1 && (
                    <div style={{ color: "#FFD700" }}>{t.rich("bonusHappyHour", { mult: summary.bonuses.happyHourMult, b: (c) => <b>{c}</b> })}</div>
                  )}
                  {summary.bonuses.boostMult > 1 && (
                    <div style={{ color: "#FFD700" }}>{t.rich("bonusCoinBoost", { mult: summary.bonuses.boostMult, b: (c) => <b>{c}</b> })}</div>
                  )}
                  {summary.bonuses.crewBoostMult > 1 && (
                    <div style={{ color: "#22D1C3" }}>{t.rich("bonusCrewBoost", { mult: summary.bonuses.crewBoostMult, b: (c) => <b>{c}</b> })}</div>
                  )}
                </div>
              </div>
            )}

            {summary.newAchievements && summary.newAchievements.length > 0 && (
              <div style={{
                padding: 12, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(168,85,247,0.1))",
                border: "1px solid rgba(255,215,0,0.5)",
                marginBottom: 14,
              }}>
                <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1, marginBottom: 8 }}>
                  {t("achievementsHeader", { count: summary.newAchievements.length })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {summary.newAchievements.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ fontSize: 18 }}>{a.icon}</span>
                      <span style={{ color: "#FFF", flex: 1, fontWeight: 700 }}>{a.name}</span>
                      <span style={{ color: "#FFD700", fontWeight: 900 }}>+{a.xp.toLocaleString(numLocale)} 🪙</span>
                    </div>
                  ))}
                </div>
                {summary.achievementXp && summary.achievementXp > 0 ? (
                  <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 8, textAlign: "right" }}>
                    {t.rich("achievementSum", { xp: summary.achievementXp.toLocaleString(numLocale), b: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}
                  </div>
                ) : null}
              </div>
            )}

            <button
              onClick={() => onClose(bonusXp)}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14,
                background: "#22D1C3", color: "#0F1115",
                border: "none", cursor: "pointer",
                fontSize: 15, fontWeight: 900,
              }}
            >
              {t("continueButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "rgba(70, 82, 122, 0.35)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
        <span>{icon}</span> <span>{label}</span>
      </div>
      <div style={{ color: accent, fontSize: 16, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function BreakdownRow({ icon, label, value, accent = "#a8b4cf", numLocale = "de-DE" }: { icon: string; label: string; value: number; accent?: string; numLocale?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <span style={{ color: "#a8b4cf", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span><span>{label}</span>
      </span>
      <span style={{ color: accent, fontWeight: 800, fontFamily: "monospace" }}>+{value.toLocaleString(numLocale)}</span>
    </div>
  );
}

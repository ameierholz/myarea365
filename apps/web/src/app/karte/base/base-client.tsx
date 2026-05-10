"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { FullscreenFrame } from "../_components/fullscreen-frame";
import { UiIcon, useUiIconArt, useMarkerArt, useBaseRingArt, useArtworkReady } from "@/components/resource-icon";

const ServerOverviewModal = dynamic(
  () => import("@/components/server-overview-modal").then((m) => m.ServerOverviewModal),
  { ssr: false },
);
const AchievementsModal = dynamic(
  () => import("@/components/achievements-modal").then((m) => m.AchievementsModal),
  { ssr: false },
);
const StatsModal = dynamic(
  () => import("@/components/stats-modal").then((m) => m.StatsModal),
  { ssr: false },
);
const BuildModal = dynamic(
  () => import("@/components/build-modal").then((m) => m.BuildModal),
  { ssr: false },
);

type Profile = Record<string, unknown>;
function s(p: Profile, k: string): string | null {
  const v = p[k];
  return typeof v === "string" ? v : null;
}
function n(p: Profile, k: string): number {
  const v = p[k];
  return typeof v === "number" ? v : 0;
}

const ACCENT = "#22D1C3";
const PINK = "#FF2D78";
const GOLD = "#FFD700";

const FACTION_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  gossenbund:  { label: "Gossenbund",  emoji: "🗝️", color: "#FF6B4A" },
  syndicate:   { label: "Gossenbund",  emoji: "🗝️", color: "#FF6B4A" },
  kronenwacht: { label: "Kronenwacht", emoji: "👑", color: "#FFD700" },
  vanguard:    { label: "Kronenwacht", emoji: "👑", color: "#FFD700" },
};

export function BaseClient({
  profile,
  crew,
  achievementsCount,
  achievementsTotal,
  achievementTiers,
  base,
  queueCount,
  researchCount,
  homeCity,
}: {
  profile: Profile | null;
  crew: { id: string; name: string; tag: string | null; color: string | null; role: string } | null;
  achievementsCount: number;
  achievementsTotal: number;
  achievementTiers: { bronze: number; silver: number; gold: number };
  base: { level?: number; plz?: string } | null;
  queueCount: number;
  researchCount: number;
  homeCity: { slug: string; name: string; era_number: number | null; era_started_at: string | null } | null;
}) {
  const [showServerOverview, setShowServerOverview] = useState(false);
  const [achievementTier, setAchievementTier] = useState<"bronze" | "silver" | "gold" | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showBuild, setShowBuild] = useState(false);

  if (!profile) {
    return (
      <FullscreenFrame title="Base" theme="urban">
        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.65)" }}>Profil nicht gefunden.</div>
      </FullscreenFrame>
    );
  }

  const username = s(profile, "username");
  const displayName = s(profile, "display_name");
  const name = displayName || username || "Spieler";
  const factionKey = s(profile, "faction");
  const faction = factionKey ? FACTION_INFO[factionKey] : null;
  const equippedMarker = s(profile, "equipped_marker_id") || "foot";
  const equippedMarkerVariant = (s(profile, "equipped_marker_variant") as "neutral" | "male" | "female" | null) || "neutral";
  const equippedBaseRing = s(profile, "equipped_base_ring_id");
  const artReady = useArtworkReady();
  const markerArt = useMarkerArt();
  const baseRingArt = useBaseRingArt();
  // Hydration-Safe: Marker/Ring-Art erst nach Cache-Ready exposen, sonst
  // rendert Server den Fallback-Avatar während Client schon das Bild hat.
  const markerAsset = artReady ? (markerArt[equippedMarker]?.[equippedMarkerVariant] ?? markerArt[equippedMarker]?.neutral) : null;
  const ringAsset = artReady && equippedBaseRing && equippedBaseRing !== "default" ? baseRingArt[equippedBaseRing] : null;
  const uiIconArtMap = useUiIconArt();
  const ringColor = faction?.color ?? GOLD;
  const city = s(profile, "city");
  const district = s(profile, "district");
  const ansehen = n(profile, "ansehen");
  const vertrauen = n(profile, "vertrauen");

  const achGold   = achievementTiers.gold;
  const achSilver = achievementTiers.silver;
  const achBronze = achievementTiers.bronze;

  return (
    <FullscreenFrame title="Meine Base" subtitle={username ? `@${username}` : undefined} theme="urban" bgSlot="karte_base_bg">
      <style>{`
        @keyframes ma365Sparkle { 0%,100% { opacity: 0; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes ma365TileBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes ma365HeroPulse { 0%,100% { box-shadow: 0 0 24px rgba(255,210,122,0.55), inset 0 0 12px rgba(255,210,122,0.3); } 50% { box-shadow: 0 0 36px rgba(255,210,122,0.85), inset 0 0 18px rgba(255,210,122,0.5); } }

        /* Tag-Funken — dezente warme Lichtpunkte */
        .ma365-bg-sparkle {
          position: absolute; width: 2px; height: 2px; border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 0 4px rgba(255,244,214,0.8);
          pointer-events: none;
          animation: ma365Sparkle 2.4s ease-in-out infinite;
        }

        /* Tile ohne Glas-Karte — nur Icon + Label, transparent */
        .ma365-tile-wrap {
          all: unset;
          position: relative;
          box-sizing: border-box;
          width: 100%;
          max-width: 120px;
          height: 76px;
          padding-top: 2px;
          padding-bottom: 2px;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0;
          cursor: pointer;
          transition: transform 0.2s, filter 0.2s;
        }
        .ma365-tile-wrap:hover {
          transform: translateY(-2px) scale(1.04);
          filter: drop-shadow(0 0 10px rgba(255,210,122,0.5));
        }
        .ma365-tile-art {
          position: relative;
          width: 100%;
          max-width: 82px;
          height: 58px;
          display: flex; align-items: center; justify-content: center;
        }
        /* Schimmer hinter dem Icon: kräftiger dunkler Halo (radial), damit
           das Icon vor jedem Hintergrund klar herausgehoben wird. */
        .ma365-tile-art::before {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 35%, rgba(0,0,0,0.3) 60%, transparent 80%);
          filter: blur(10px);
          z-index: 0;
          pointer-events: none;
        }
        .ma365-tile-icon {
          font-size: 52px; line-height: 1; position: relative; z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
          animation: ma365TileBob 4s ease-in-out infinite;
        }
        /* UiIcon (img/video) auch über den Halo legen */
        .ma365-tile-art > img,
        .ma365-tile-art > video,
        .ma365-tile-art > span:not(.ma365-tile-icon) {
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
        }
        .ma365-tile-label {
          font-size: 10px; font-weight: 800; letter-spacing: 0.2px;
          color: #FFF;
          /* Mehrlagiger Text-Halo: enge harte Schatten + weicher dunkler Glow */
          text-shadow:
            0 0 4px rgba(0,0,0,0.95),
            0 0 8px rgba(0,0,0,0.7),
            0 1px 2px rgba(0,0,0,0.9),
            0 -1px 1px rgba(0,0,0,0.8);
          line-height: 1.2;
          margin-top: 2px;
          max-width: 100%;
          padding: 0 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          position: relative;
          z-index: 2;
        }
        /* Sanfter dunkler Glow hinter dem Label-Text (extra Lesbarkeits-Boost) */
        .ma365-tile-label::before {
          content: "";
          position: absolute;
          inset: -2px -6px;
          background: radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 75%);
          filter: blur(4px);
          z-index: -1;
          pointer-events: none;
        }
      `}</style>

      {/* Hintergrund-Sparkles als atmosphärische Schicht */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="ma365-bg-sparkle"
            style={{
              top: `${(i * 37) % 95}%`,
              left: `${(i * 53) % 95}%`,
              animationDelay: `${(i % 5) * 0.4}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* Vertikales Layout: Banner oben (volle Breite), Action-Tiles darunter.
          KEIN SCROLL — alles passt in 412px Landscape-Höhe. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", position: "relative", zIndex: 1, overflow: "hidden" }}>
        {/* BANNER — Avatar links, Stats-Grid rechts */}
        <div style={{
          flexShrink: 0,
          display: "grid", gridTemplateColumns: "128px 1fr", gap: 10,
          padding: "10px 12px",
          background: "linear-gradient(180deg, rgba(15,17,21,0.55) 0%, rgba(15,17,21,0.4) 100%)",
          backdropFilter: "blur(8px) saturate(1.1)",
          WebkitBackdropFilter: "blur(8px) saturate(1.1)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        }}>
          {/* Avatar — Ring + Marker beide zentriert via translate, gleicher Abstand zum Rand */}
          <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0 }}>
            {ringAsset?.image_url || ringAsset?.video_url ? (
              ringAsset.video_url ? (
                <video
                  src={ringAsset.video_url}
                  autoPlay loop muted playsInline
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 128, height: 128, objectFit: "contain",
                    filter: `url(#ma365-chroma-black) drop-shadow(0 0 10px ${ringColor}77)`,
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ringAsset.image_url!}
                  alt=""
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 128, height: 128, objectFit: "contain",
                    filter: `url(#ma365-chroma-black) drop-shadow(0 0 10px ${ringColor}77)`,
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              )
            ) : (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 116, height: 116,
                borderRadius: "50%",
                border: `3px solid ${ringColor}`,
                boxShadow: `0 0 18px ${ringColor}88`,
                animation: "ma365HeroPulse 3.6s ease-in-out infinite",
                pointerEvents: "none",
              }} />
            )}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 88, height: 88,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(70,82,122,0.5))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "inset 0 0 14px rgba(0,0,0,0.4)",
              overflow: "hidden",
              zIndex: 2,
            }}>
              {markerAsset?.video_url ? (
                <video src={markerAsset.video_url} autoPlay loop muted playsInline
                  style={{ width: 78, height: 78, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }} />
              ) : markerAsset?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={markerAsset.image_url} alt=""
                  style={{ width: 78, height: 78, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }} />
              ) : (
                <span style={{ fontSize: 56, color: "#FFE4B8", fontWeight: 900, textShadow: "0 2px 4px rgba(0,0,0,0.7)", lineHeight: 1 }}>
                  {(name[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Stats-Bereich rechts — 3 Spalten Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            {/* Headline-Zeile: Crew-Tag + Name + Faction-Pill + Server-Pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {crew?.tag && (
                <span style={{
                  padding: "2px 7px", borderRadius: 4,
                  background: "rgba(255,255,255,0.1)",
                  color: "#FFF", fontWeight: 900, fontSize: 10, letterSpacing: 0.5,
                  border: "1px solid rgba(255,255,255,0.25)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}>{crew.tag}</span>
              )}
              <span style={{ fontSize: 16, fontWeight: 900, color: "#FFF", textShadow: "0 1px 3px rgba(0,0,0,0.85)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </span>
              {faction && (
                <Pill label={`${faction.emoji} ${faction.label}`} color={faction.color} />
              )}
              {homeCity && (
                <Pill
                  label={homeCity.era_number != null ? `🏙️ ${homeCity.name} · Ära ${homeCity.era_number}` : `🏙️ ${homeCity.name}`}
                  color={ACCENT}
                />
              )}
            </div>

            {/* Info-Grid (3 Spalten) — Spalte C breiter, weil ScoreCards + CvcBar mehr Platz brauchen */}
            <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1fr 1.35fr", gap: 8, flex: 1, minHeight: 0 }}>
              {/* Spalte A — Stats-Liste */}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 10 }}>
                <StatRow label="Heimat" value={homeCity?.name ?? city ?? district ?? "—"} />
                <StatRow label="Server-ID" value={homeCity?.slug ?? "—"} />
                <StatRow label="Crew" value={crew?.name ?? "—"} />
                <StatRow label="Eingereist" value={accountAgeLabel(profile)} />
                <StatRow label="Erfolge" value={achievementsTotal > 0 ? `${achievementsCount} / ${achievementsTotal}` : achievementsCount.toString()} />
              </div>

              {/* Spalte B — Medaillen + Ära-Box */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  <Medal tier="gold"   count={achGold}   art={uiIconArtMap} onClick={() => setAchievementTier("gold")} />
                  <Medal tier="silver" count={achSilver} art={uiIconArtMap} onClick={() => setAchievementTier("silver")} />
                  <Medal tier="bronze" count={achBronze} art={uiIconArtMap} onClick={() => setAchievementTier("bronze")} />
                </div>
                {homeCity && (
                  <div style={{
                    fontSize: 9, color: "rgba(255,255,255,0.7)",
                    padding: "5px 7px", borderRadius: 6,
                    background: `${ACCENT}1a`, border: `1px solid ${ACCENT}44`,
                    display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.2,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>Aktuelle Ära</span>
                      <span style={{ color: ACCENT, fontWeight: 900, fontSize: 12, textShadow: `0 0 6px ${ACCENT}66` }}>
                        {homeCity.era_number ?? "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>läuft seit</span>
                      <span style={{ color: "#FFF", fontWeight: 800, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                        {homeCity.era_started_at
                          ? `${daysSince(homeCity.era_started_at)} ${daysSince(homeCity.era_started_at) === 1 ? "Tag" : "Tagen"}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Spalte C — Ansehen + Vertrauen + schmaler CvC-Balken */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <ScoreCard label="Ansehen"   icon="🌟" value={ansehen}   color={GOLD}   hint="Bauen · Forschen · Banditen" />
                  <ScoreCard label="Vertrauen" icon="🤝" value={vertrauen} color={ACCENT} hint="Banditen-Kills (CvC)" />
                </div>
                <CvcBar
                  joined={n(profile, "cvc_participated")}
                  won={n(profile, "cvc_won")}
                  peak={n(profile, "vertrauen_peak") || vertrauen}
                />
              </div>
            </div>
          </div>
        </div>

        {/* TILES — 2×5 oben-rechts; lässt Chat-Widget unten-links frei.
            Tiles wurden auf 76px Höhe verkleinert damit 2 Reihen sicher
            in den verbleibenden Container passen. */}
        <div style={{
          flex: 1, minHeight: 0,
          display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
          padding: "8px 4px 0",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 6,
            width: "min(540px, 60%)",
          }}>
            <ArtTile slot="karte_base_bauen"         icon="🔨" label="Bauen"        onClick={() => setShowBuild(true)} badge={queueCount} />
            <ArtTile slot="karte_base_forschung"     icon="⚗️" label="Forschung"    href="/karte/base"   badge={researchCount} />
            <ArtTile slot="karte_base_banditen"      icon="🥷" label="Banditen"     href="/karte/base" />
            <ArtTile slot="karte_base_trophaeen"     icon="🏆" label="Trophäen"     onClick={() => setAchievementTier("bronze")} badge={achievementsCount} />
            <ArtTile slot="karte_base_ranglisten"    icon="📊" label="Ranglisten"   href="/karte/base" />
            <ArtTile slot="karte_base_statistiken"   icon="📈" label="Statistiken"  onClick={() => setShowStats(true)} />
            <ArtTile slot="karte_base_server"        icon="🏙️" label="Server"       onClick={() => setShowServerOverview(true)} />
            <ArtTile slot="karte_base_einstellungen" icon="⚙️" label="Einstellungen" href="/karte/base" />
            <ArtTile slot="karte_base_logout"        icon="🚪" label="Ausloggen"    href="/logout" />
          </div>
        </div>
      </div>

      <ServerOverviewModal
        open={showServerOverview}
        onClose={() => setShowServerOverview(false)}
      />
      <AchievementsModal
        open={achievementTier !== null}
        onClose={() => setAchievementTier(null)}
        initialTier={achievementTier ?? "bronze"}
      />
      <StatsModal open={showStats} onClose={() => setShowStats(false)} />
      {showBuild && <BuildModal onClose={() => setShowBuild(false)} />}
    </FullscreenFrame>
  );
}

function ArtTile({ slot, icon, label, href, onClick, badge, iconSize = 72 }: {
  slot: string;
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  /** Override Icon-Größe (Default 72). Emoji-Fallback skaliert proportional. */
  iconSize?: number;
}) {
  const art = useUiIconArt();
  const inner = (
    <>
      <div className="ma365-tile-art">
        {/* Wenn Artwork hochgeladen, rendert UiIcon es; sonst fallback Emoji */}
        {art[slot]?.image_url || art[slot]?.video_url ? (
          <UiIcon slot={slot} fallback={icon} art={art} size={iconSize} />
        ) : (
          <span className="ma365-tile-icon" style={iconSize !== 72 ? { fontSize: Math.round(iconSize * 0.72) } : undefined}>{icon}</span>
        )}

        {badge !== undefined && badge > 0 && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 18, height: 18, borderRadius: 999,
            background: "linear-gradient(135deg, #FF6B4A, #FF2D78)",
            color: "#FFF",
            fontSize: 9, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 5px",
            border: "1.5px solid rgba(255,255,255,0.95)",
            boxShadow: "0 2px 6px rgba(255,45,120,0.5)",
            zIndex: 4,
          }}>{badge}</div>
        )}
      </div>
      <div className="ma365-tile-label">{label}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="ma365-tile-wrap">
        {inner}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className="ma365-tile-wrap">
      {inner}
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
      <span style={{ color: "#FFF", fontSize: 10, fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,0.5)", maxWidth: "62%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color, fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
      whiteSpace: "nowrap",
      textShadow: `0 0 6px ${color}66`,
    }}>{label}</span>
  );
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

function accountAgeLabel(p: Profile): string {
  const created = s(p, "created_at");
  if (!created) return "—";
  const days = daysSince(created);
  if (days < 1) return "heute";
  if (days < 30) return `${days} ${days === 1 ? "Tag" : "Tage"}`;
  if (days < 365) return `${Math.floor(days / 30)} Mon.`;
  return `${(days / 365).toFixed(1)} J.`;
}

const MEDAL_META = {
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.6)",  label: "Gold",   ring: "#B8860B" },
  silver: { color: "#C0C8D0", glow: "rgba(192,200,208,0.5)", label: "Silber", ring: "#7A8290" },
  bronze: { color: "#CD7F32", glow: "rgba(205,127,50,0.55)", label: "Bronze", ring: "#7A4A1F" },
} as const;

function Medal({ tier, count, art, onClick }: {
  tier: "gold" | "silver" | "bronze";
  count: number;
  art: ReturnType<typeof useUiIconArt>;
  onClick?: () => void;
}) {
  const m = MEDAL_META[tier];
  const slot = `trophy_${tier}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${m.label}-Trophäen anzeigen`}
      style={{
        position: "relative",
        padding: "6px 3px",
        borderRadius: 8,
        background: `linear-gradient(160deg, ${m.color}33, transparent)`,
        border: `1px solid ${m.color}55`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: "none",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 0 12px ${m.glow}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <span style={{
        width: 22, height: 22, lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        filter: `drop-shadow(0 0 4px ${m.glow})`,
      }}>
        <UiIcon slot={slot} fallback="🏆" art={art} size={22} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 900, color: m.color, lineHeight: 1, textShadow: "0 1px 2px rgba(0,0,0,0.6)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

function CvcBar({ joined, won, peak }: { joined: number; won: number; peak: number }) {
  // Bewusst gleich strukturiert wie die ScoreCard-Reihe darüber: 2-col 1fr/1fr.
  // Links: CvC + Siege im Doppelpack, rechts: Höchstes Vertrauen (Spaltenbreite = Vertrauen-ScoreCard).
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
      <div style={{
        padding: "4px 7px", borderRadius: 6,
        background: `linear-gradient(135deg, ${PINK}1a 0%, rgba(255,255,255,0.04) 100%)`,
        border: `1px solid ${PINK}44`,
        display: "flex", alignItems: "center", justifyContent: "space-around", gap: 4,
      }}>
        <CvcBarItem label="CvC" value={joined} color="#FFF" />
        <CvcBarItem label="Siege" value={won} color={GOLD} />
      </div>
      <div style={{
        padding: "4px 7px", borderRadius: 6,
        background: `linear-gradient(135deg, ${ACCENT}1a 0%, rgba(255,255,255,0.04) 100%)`,
        border: `1px solid ${ACCENT}44`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1,
      }}>
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.65)", letterSpacing: 0.3, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap" }}>
          Peak-Vertrauen
        </span>
        <span style={{ fontSize: 10, fontWeight: 900, color: ACCENT, textShadow: `0 0 6px ${ACCENT}66`, fontVariantNumeric: "tabular-nums", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", letterSpacing: -0.2 }}>
          {peak.toLocaleString("de-DE")}
        </span>
      </div>
    </div>
  );
}

function CvcBarItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, minWidth: 0 }}>
      <span style={{ fontSize: 7, color: "rgba(255,255,255,0.65)", letterSpacing: 0.3, fontWeight: 700, textAlign: "center" }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 900, color, textShadow: `0 0 6px ${color}66`, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
        {value.toLocaleString("de-DE")}
      </span>
    </div>
  );
}

function ScoreCard({ label, icon, value, color, hint }: {
  label: string; icon: string; value: number; color: string; hint: string;
}) {
  return (
    <div style={{
      padding: "5px 7px",
      borderRadius: 8,
      background: `linear-gradient(135deg, ${color}22 0%, rgba(255,255,255,0.04) 100%)`,
      border: `1px solid ${color}55`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, letterSpacing: 0.3 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color, textShadow: `0 0 8px ${color}88`, lineHeight: 1.1, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums", letterSpacing: -0.2 }}>
        {value.toLocaleString("de-DE")}
      </div>
      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", fontStyle: "italic", lineHeight: 1.2, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

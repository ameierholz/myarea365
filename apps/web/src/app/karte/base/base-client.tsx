"use client";

import Link from "next/link";
import { FullscreenFrame } from "../_components/fullscreen-frame";
import { UiIcon, useUiIconArt, useMarkerArt, useBaseRingArt } from "@/components/resource-icon";

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

const ROLE_LABEL: Record<string, string> = {
  leader: "Anführer",
  officer: "Offizier",
  member: "Mitglied",
};

export function BaseClient({
  profile,
  crew,
  achievementsCount,
  base,
  queueCount,
  researchCount,
}: {
  profile: Profile | null;
  crew: { id: string; name: string; tag: string | null; color: string | null; role: string } | null;
  achievementsCount: number;
  base: { level?: number; plz?: string } | null;
  queueCount: number;
  researchCount: number;
}) {
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
  const markerArt = useMarkerArt();
  const baseRingArt = useBaseRingArt();
  const markerAsset = markerArt[equippedMarker]?.[equippedMarkerVariant] ?? markerArt[equippedMarker]?.neutral;
  const ringAsset = equippedBaseRing && equippedBaseRing !== "default" ? baseRingArt[equippedBaseRing] : null;
  const ringColor = faction?.color ?? GOLD;
  const city = s(profile, "city");
  const district = s(profile, "district");
  const baseLevel = base?.level ?? 1;
  const ansehen = n(profile, "ansehen");
  const vertrauen = n(profile, "vertrauen");

  // Achievement-Trio: Bronze/Silber/Gold split (Approximation — 3 Tiers à 1/3, 1/3, 1/3 vom Total)
  const achGold   = Math.max(0, Math.round(achievementsCount * 0.15));
  const achSilver = Math.max(0, Math.round(achievementsCount * 0.30));
  const achBronze = Math.max(0, achievementsCount - achGold - achSilver);

  return (
    <FullscreenFrame title={name} subtitle={username ? `@${username}` : undefined} theme="urban" bgSlot="karte_base_bg">
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

        /* Tile = Artwork-Container, Label SITZT DRUNTER (CoD-Stil), kein Background */
        .ma365-tile-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          text-decoration: none;
        }
        .ma365-tile-art {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 14px;
          background: linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%);
          border: 1.5px solid rgba(255,255,255,0.16);
          box-shadow: 0 4px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.25s, box-shadow 0.25s;
          overflow: hidden;
        }
        .ma365-tile-art::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
          pointer-events: none;
        }
        .ma365-tile-art:hover {
          transform: translateY(-2px) scale(1.04);
          border-color: rgba(255,228,184,0.6);
          box-shadow: 0 10px 22px rgba(0,0,0,0.4), 0 0 18px rgba(255,210,122,0.55), inset 0 1px 0 rgba(255,255,255,0.3);
        }
        .ma365-tile-icon {
          font-size: 30px; line-height: 1; position: relative; z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          animation: ma365TileBob 4s ease-in-out infinite;
        }
        .ma365-tile-label {
          font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
          color: #FFF;
          text-shadow: 0 1px 2px rgba(0,0,0,0.7);
          line-height: 1;
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

      {/* 2-Spalten — Hero-Banner links, Action-Tiles rechts. KEIN SCROLL — alles passt in 412px Höhe */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 32%) 1fr", gap: 12, height: "100%", position: "relative", zIndex: 1, overflow: "hidden" }}>
        {/* LINKS — Hero-Banner */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, overflow: "hidden" }}>
          {/* Avatar (Marker-Artwork) + Avatar-Rahmen (Base-Ring-Artwork) */}
          <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0, marginBottom: 16 }}>
            {/* Avatar-Rahmen — equippierter Base-Ring (Halo) */}
            {ringAsset?.image_url || ringAsset?.video_url ? (
              ringAsset.video_url ? (
                <video
                  src={ringAsset.video_url}
                  autoPlay loop muted playsInline
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%) scale(1.5)",
                    width: 90, height: 90, objectFit: "contain",
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
                    transform: "translate(-50%, -50%) scale(1.5)",
                    width: 90, height: 90, objectFit: "contain",
                    filter: `url(#ma365-chroma-black) drop-shadow(0 0 10px ${ringColor}77)`,
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              )
            ) : (
              // Fallback Goldring wenn kein Base-Ring equipped
              <div style={{
                position: "absolute", top: 4, left: 4, width: 88, height: 88,
                borderRadius: "50%",
                border: `3px solid ${ringColor}`,
                boxShadow: `0 0 18px ${ringColor}88`,
                animation: "ma365HeroPulse 3.6s ease-in-out infinite",
                pointerEvents: "none",
              }} />
            )}

            {/* Avatar — equippierter Marker */}
            <div style={{
              position: "absolute", top: 8, left: 8, width: 80, height: 80,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(70,82,122,0.5))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "inset 0 0 14px rgba(0,0,0,0.4)",
              overflow: "hidden",
              zIndex: 2,
            }}>
              {markerAsset?.video_url ? (
                <video
                  src={markerAsset.video_url}
                  autoPlay loop muted playsInline
                  style={{ width: 70, height: 70, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }}
                />
              ) : markerAsset?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={markerAsset.image_url}
                  alt=""
                  style={{ width: 70, height: 70, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }}
                />
              ) : (
                <span style={{ fontSize: 50, color: "#FFE4B8", fontWeight: 900, textShadow: "0 2px 4px rgba(0,0,0,0.7)", lineHeight: 1 }}>
                  {(name[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>

            {/* Level-Badge */}
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              padding: "3px 12px", borderRadius: 999,
              background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
              color: "#0F1115", fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
              border: "2px solid #FFE4B8",
              boxShadow: "0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
              whiteSpace: "nowrap",
              zIndex: 3,
            }}>Lv {baseLevel}</div>
          </div>

          {/* Name */}
          <div style={{ textAlign: "center", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
            {crew?.tag && (
              <span style={{
                padding: "1px 6px", borderRadius: 4,
                background: crew.color || GOLD,
                color: "#0F1115",
                fontWeight: 900, fontSize: 9, letterSpacing: 0.5,
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}>{crew.tag}</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 900, color: "#FFF", textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)" }}>{name}</span>
          </div>

          {/* Compact stats */}
          <div style={{ width: "100%", display: "grid", gap: 1, fontSize: 9, flexShrink: 0 }}>
            <StatRow label="Heimatstadt" value={city || district || "—"} />
            <StatRow label="Crew" value={crew?.name ?? "—"} />
            <StatRow label="Fraktion" value={faction ? `${faction.emoji} ${faction.label}` : "—"} />
          </div>

          {/* Trophäen-Trio */}
          <div style={{ width: "100%", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
              <Medal tier="gold"   count={achGold} />
              <Medal tier="silver" count={achSilver} />
              <Medal tier="bronze" count={achBronze} />
            </div>
          </div>

          {/* Ansehen + Vertrauen — Label oben, Wert darunter */}
          <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flexShrink: 0 }}>
            <ScoreCard label="Ansehen"   icon="🌟" value={ansehen}   color={PINK}   hint="Bauen · Forschen · Banditen ausbilden" />
            <ScoreCard label="Vertrauen" icon="🤝" value={vertrauen} color={ACCENT} hint="Banditen-Kills im aktiven + letzten CvC" />
          </div>
        </div>

        {/* RECHTS — Action-Tile-Bereich mit atmosphärischem Hintergrund */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Atmosphärischer Hintergrund: Skyline-Silhouette + Glow */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 16, overflow: "hidden" }}>
            {/* Sonnen-Glow oben */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "70%",
              background: "radial-gradient(ellipse at 50% 0%, rgba(255,244,214,0.55) 0%, rgba(255,210,122,0.2) 40%, transparent 75%)",
            }} />
            {/* Skyline-SVG */}
            <svg
              viewBox="0 0 600 120" preserveAspectRatio="none"
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, width: "100%", height: "55%", opacity: 0.5 }}
            >
              <defs>
                <linearGradient id="ma365-base-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFF4D6" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#5A8FB5" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="ma365-base-window" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#FFE4B8" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {/* Hochhäuser-Silhouette */}
              <path
                d="M0 120 L0 70 L40 70 L40 50 L75 50 L75 80 L100 80 L100 30 L130 30 L130 60 L160 60 L160 45 L195 45 L195 75 L220 75 L220 55 L250 55 L250 25 L285 25 L285 65 L315 65 L315 40 L345 40 L345 70 L380 70 L380 50 L410 50 L410 35 L445 35 L445 70 L470 70 L470 55 L500 55 L500 80 L530 80 L530 45 L560 45 L560 65 L600 65 L600 120 Z"
                fill="url(#ma365-base-sky)"
              />
              {/* Beleuchtete Fenster — pulsen sanft */}
              <g fill="url(#ma365-base-window)">
                <rect x="48" y="60" width="4" height="5"><animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" /></rect>
                <rect x="108" y="40" width="4" height="5"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.6s" repeatCount="indefinite" begin="0.5s" /></rect>
                <rect x="170" y="55" width="4" height="5"><animate attributeName="opacity" values="0.3;1;0.3" dur="3.2s" repeatCount="indefinite" begin="1s" /></rect>
                <rect x="260" y="35" width="4" height="5"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" begin="1.4s" /></rect>
                <rect x="328" y="50" width="4" height="5"><animate attributeName="opacity" values="0.4;1;0.4" dur="3.4s" repeatCount="indefinite" begin="0.2s" /></rect>
                <rect x="395" y="45" width="4" height="5"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite" begin="1.8s" /></rect>
                <rect x="478" y="65" width="4" height="5"><animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" begin="0.8s" /></rect>
                <rect x="540" y="55" width="4" height="5"><animate attributeName="opacity" values="0.4;1;0.4" dur="2.7s" repeatCount="indefinite" begin="1.2s" /></rect>
              </g>
            </svg>
          </div>

          {/* Tile-Grid 4×2 */}
          <div style={{
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: "repeat(4, max-content)",
            gridAutoRows: "max-content",
            rowGap: 6,
            columnGap: 6,
            padding: "4px",
          }}>
            <ArtTile slot="karte_base_bauen"      icon="🔨" label="Bauen"       href="/karte/base"   badge={queueCount} />
            <ArtTile slot="karte_base_forschung"  icon="⚗️" label="Forschung"   href="/karte/base"   badge={researchCount} />
            <ArtTile slot="karte_base_banditen"   icon="🥷" label="Banditen"    href="/karte/base" />
            <ArtTile slot="karte_base_trophaeen"  icon="🏆" label="Trophäen"    href="/karte/base" />
            <ArtTile slot="karte_base_ranglisten" icon="📊" label="Ranglisten"  href="/karte/base" />
            <ArtTile slot="karte_base_statistiken" icon="📈" label="Statistiken" href="/karte/base" />
            <ArtTile slot="karte_base_einstellungen" icon="⚙️" label="Einstellungen" href="/karte/base" />
            <ArtTile slot="karte_base_logout"     icon="🚪" label="Ausloggen"   href="/logout" />
          </div>
        </div>
      </div>
    </FullscreenFrame>
  );
}

function ArtTile({ slot, icon, label, href, badge }: {
  slot: string;
  icon: string;
  label: string;
  href: string;
  badge?: number;
}) {
  const art = useUiIconArt();
  return (
    <Link href={href} className="ma365-tile-wrap">
      <div className="ma365-tile-art">
        {/* Wenn Artwork hochgeladen, rendert UiIcon es; sonst fallback Emoji */}
        {art[slot]?.image_url || art[slot]?.video_url ? (
          <UiIcon slot={slot} fallback={icon} art={art} size={64} />
        ) : (
          <span className="ma365-tile-icon">{icon}</span>
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

const MEDAL_META = {
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.6)",  label: "Gold",   ring: "#B8860B" },
  silver: { color: "#C0C8D0", glow: "rgba(192,200,208,0.5)", label: "Silber", ring: "#7A8290" },
  bronze: { color: "#CD7F32", glow: "rgba(205,127,50,0.55)", label: "Bronze", ring: "#7A4A1F" },
} as const;

function Medal({ tier, count }: { tier: "gold" | "silver" | "bronze"; count: number }) {
  const m = MEDAL_META[tier];
  return (
    <div style={{
      position: "relative",
      padding: "3px 2px",
      borderRadius: 8,
      background: `linear-gradient(160deg, ${m.color}33, transparent)`,
      border: `1px solid ${m.color}55`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
    }}>
      <span style={{
        fontSize: 14, lineHeight: 1,
        filter: `drop-shadow(0 0 4px ${m.glow})`,
      }}>🏆</span>
      <span style={{ fontSize: 11, fontWeight: 900, color: m.color, lineHeight: 1, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>{count}</span>
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
      <div style={{ fontSize: 14, fontWeight: 900, color, textShadow: `0 0 8px ${color}88`, lineHeight: 1.1, marginTop: 1 }}>
        {value.toLocaleString("de-DE")}
      </div>
      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", fontStyle: "italic", lineHeight: 1.2, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

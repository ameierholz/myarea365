"use client";

/**
 * KARTEN-HUD — Header-Bar oben links + oben rechts, RoK-Style.
 *
 * Links: Profil-Avatar · Vertrauen · VIP · Buffs · UTC-Zeit
 * Rechts: Diamanten · Resources · Aktions-Buttons (Deals/Shop/CvC)
 *
 * Position: fixed top:6, z-Index 9050 (über Map, unter Modals).
 * Mobile-first: Werte gekürzt (z.B. 1.2M statt 1.234.567), 915×412 Landscape.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ResourceIcon, useResourceArt, UiIcon, useUiIconArt, type ResourceKind, type ResourceArtMap } from "@/components/resource-icon";
import { QuestTeaser } from "@/components/quest-teaser";
import { TimeWeatherBanner } from "@/components/time-weather-banner";
import { WeatherAtmosphereOverlay } from "@/components/weather-atmosphere-overlay";
import { useHudHidden } from "@/lib/modal-stack";

type HudData = {
  ok: boolean;
  user: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; level: number; home_city_slug: string | null } | null;
  vertrauen: number;
  vip_level: number;
  gems: number;
  resources: { wood: number; stone: number; gold: number; mana: number; speed_tokens: number; vip_tickets: number };
  buffs: Array<{ key?: string; label?: string; ends_at?: string; magnitude?: number }>;
  avatar_rahmen: { image_url: string | null; video_url: string | null } | null;
  rank: { id: number; name: string; color: string } | null;
  quests: { claimable: number; in_progress: number };
};

function fmtVertrauen(n: number): string {
  return n.toLocaleString("de-DE");
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("de-DE");
}

function fmtUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `UTC ${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function KartenHud({
  onProfileClick,
  onVipClick,
  onBuffsClick,
  onQuestsClick,
  onGemsClick,
  onDealsClick,
  onShopClick,
  onCvcClick,
  questsOpen = false,
  questReloadKey = 0,
}: {
  onProfileClick?: () => void;
  onVipClick?: () => void;
  onBuffsClick?: () => void;
  onQuestsClick?: () => void;
  onGemsClick?: () => void;
  onDealsClick?: () => void;
  onShopClick?: () => void;
  onCvcClick?: () => void;
  /** Wenn das QuestModal offen ist, blenden wir den Teaser aus (sitzt sonst hinter Backdrop). */
  questsOpen?: boolean;
  /** Bei Increment lädt der Teaser seine Daten neu (nach Claim im Modal). */
  questReloadKey?: number;
}) {
  const [data, setData] = useState<HudData | null>(null);
  // Empty on SSR — fmtUtc(new Date()) würde Hydration-Mismatch erzeugen
  // (Server-Zeit ≠ Client-Zeit beim Re-Hydrate). Wird im useEffect unten gesetzt.
  const [utc, setUtc] = useState<string>("");
  const resourceArt = useResourceArt();
  const uiIconArt = useUiIconArt();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/me/hud-summary", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as HudData;
        if (!cancelled) setData(j);
      } catch { /* silent */ }
    };
    void load();
    // Realtime: refresh on resource/inbox/troop/quest events; Poll 2min als Fallback.
    const id = setInterval(load, 120_000);
    const reload = () => { void load(); };
    window.addEventListener("ma365:resources-changed", reload);
    window.addEventListener("ma365:inbox-changed", reload);
    window.addEventListener("ma365:troops-changed", reload);
    return () => {
      cancelled = true; clearInterval(id);
      window.removeEventListener("ma365:resources-changed", reload);
      window.removeEventListener("ma365:inbox-changed", reload);
      window.removeEventListener("ma365:troops-changed", reload);
    };
  }, []);

  useEffect(() => {
    const tick = () => setUtc(fmtUtc(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const buffCount = data?.buffs?.length ?? 0;
  const questClaimable = data?.quests?.claimable ?? 0;

  // FullscreenFrame offen (Crew/Inventar/Shop/etc.)? Dann HUD ganz aus,
  // sonst überlagert die HUD-Bar (z 9050) das Modal (z 9000).
  const hudHidden = useHudHidden();
  if (hudHidden) return null;

  return (
    <>
      {/* Oben Links — RoK-Style HUD-Frame.
          Layout: [Profil Avatar 64px + Avatar Rahmen]  Rang-Name (gold) /
          Vertrauen (groß) / VIP-Banner + UTC. Buffs ⚡ rechts daneben. */}
      <div style={{
        position: "fixed", top: 6, left: 6, zIndex: 9050,
        display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8,
        pointerEvents: "none",
      }}>
        {/* Avatar-Spalte: Profil Avatar oben, Quest 📜 darunter mit Abstand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* Profil Avatar + Avatar Rahmen */}
        <button
          onClick={onProfileClick}
          style={{
            ...btnReset,
            pointerEvents: "auto",
            width: 64, height: 64,
            position: "relative",
            background: "transparent",
            border: "none",
            flexShrink: 0,
          }}
          aria-label="Profil Avatar"
        >
          {/* Profil Avatar (rundes Foto / Initial) */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, #22D1C3, rgba(15,17,21,0.92))`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1,
          }}>
            {data?.user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.user.avatar_url} alt="Profil Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{
                color: "#F0F0F0", fontSize: 28, fontWeight: 900,
                letterSpacing: 1, fontFamily: "Inter,-apple-system,sans-serif",
                textShadow: "0 2px 4px rgba(0,0,0,0.6)",
              }}>
                {((data?.user?.display_name || data?.user?.username || "?").trim().charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </div>
          {/* Avatar Rahmen (Halo um den Avatar, optional) */}
          {(data?.avatar_rahmen?.image_url || data?.avatar_rahmen?.video_url) && (
            data.avatar_rahmen.video_url ? (
              <video
                src={data.avatar_rahmen.video_url}
                autoPlay loop muted playsInline
                style={{
                  position: "absolute", top: "50%", left: "50%",
                  width: 140, height: 140,
                  transform: "translate(-50%, -50%) scale(1.25)",
                  objectFit: "contain",
                  filter: "url(#ma365-chroma-black)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatar_rahmen.image_url ?? ""}
                alt=""
                style={{
                  position: "absolute", top: "50%", left: "50%",
                  width: 140, height: 140,
                  transform: "translate(-50%, -50%) scale(1.25)",
                  objectFit: "contain",
                  filter: "url(#ma365-chroma-black)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            )
          )}
        </button>

        {/* Quests-Button 📜 — direkt unter Profil Avatar (Buffs sind jetzt
            inline neben VIP, siehe Info-Spalte). RoK-Style Scroll-Icon. */}
        <button
          onClick={onQuestsClick}
          style={{
            ...btnReset, pointerEvents: "auto",
            width: 44, height: 44,
            background: "transparent", border: "none",
            color: "#FFD700", fontSize: 26, fontWeight: 900,
            cursor: "pointer", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
            flexShrink: 0,
          }}
          aria-label="Quests"
          title={questClaimable > 0 ? `${questClaimable} Quest-Belohnung(en) zum Einsammeln` : "Quests öffnen"}
        >
          📜
          {questClaimable > 0 && (
            <span style={{
              position: "absolute", top: 0, right: 0,
              background: "#FF2D78", color: "#FFF",
              fontSize: 9, fontWeight: 900,
              padding: "1px 5px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.7)",
              fontFamily: "Inter,-apple-system,sans-serif",
            }}>{questClaimable}</span>
          )}
        </button>
        </div>

        {/* Info-Spalte: Rang · Vertrauen · VIP+UTC */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-start",
          pointerEvents: "auto", gap: 1,
        }}>
          {/* Ansehen-Wert — Power-Score mit Ansehen-Icon davor
              (🌟 ist projektweit das Icon für Ansehen, siehe base-client ScoreCard). */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            color: "#FFFFFF", fontSize: 17, fontWeight: 900,
            lineHeight: 1, letterSpacing: 0.2,
            fontFamily: "Inter,-apple-system,sans-serif",
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }} title="Ansehen">
            <span style={{
              fontSize: 14, lineHeight: 1,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
            }}>🌟</span>
            <span>{data ? fmtVertrauen(data.vertrauen) : "…"}</span>
          </div>

          {/* VIP-Banner + Buffs-Pill nebeneinander */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <button
              onClick={onVipClick}
              style={{
                ...btnReset, pointerEvents: "auto", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 3,
                padding: "1px 7px 1px 5px",
                background: "linear-gradient(135deg, #B8860B 0%, #FFD700 50%, #8B6914 100%)",
                borderRadius: "3px 8px 3px 8px",
                border: "1px solid rgba(255,224,122,0.7)",
                color: "#0F1115", fontSize: 10, fontWeight: 900,
                fontFamily: "Inter,-apple-system,sans-serif",
                letterSpacing: 0.4,
                boxShadow: "0 1px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
              aria-label="VIP"
              title="VIP-Stufe"
            >
              <span style={{ fontSize: 10 }}>👑</span>
              <span>VIP {data?.vip_level ?? 0}</span>
            </button>
            <button
              onClick={onBuffsClick}
              style={{
                ...btnReset, pointerEvents: "auto", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 2,
                padding: "1px 6px 1px 4px",
                background: buffCount > 0
                  ? "linear-gradient(135deg, #0f5a55 0%, #22D1C3 50%, #0a3f3b 100%)"
                  : "rgba(15,17,21,0.55)",
                borderRadius: "3px 8px 3px 8px",
                border: `1px solid ${buffCount > 0 ? "rgba(34,209,195,0.75)" : "rgba(255,255,255,0.18)"}`,
                color: buffCount > 0 ? "#0F1115" : "rgba(255,255,255,0.7)",
                fontSize: 10, fontWeight: 900,
                fontFamily: "Inter,-apple-system,sans-serif",
                letterSpacing: 0.4,
                boxShadow: "0 1px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
              aria-label="Buffs"
              title={buffCount > 0 ? `${buffCount} aktive Buffs` : "Buffs aktivieren"}
            >
              <span style={{ fontSize: 10 }}>⚡</span>
              {buffCount > 0 && <span>{buffCount}</span>}
            </button>
          </div>

          {/* UTC-Zeile — unter VIP/Buffs */}
          <div style={{
            fontSize: 9, color: "#FFFFFF", fontWeight: 900,
            whiteSpace: "nowrap", marginTop: 2,
            fontFamily: "Inter,-apple-system,sans-serif",
            textShadow: "0 0 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1), -1px 0 0 rgba(0,0,0,0.7), 1px 0 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(0,0,0,0.7), 0 1px 0 rgba(0,0,0,0.7)",
          }}>{utc}</div>
        </div>

      </div>

      {/* Oben Rechts */}
      <div style={{
        position: "fixed", top: 6, right: 6, zIndex: 9050,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
        pointerEvents: "none",
      }}>
        {/* Resource-Bar — kompaktes Padding, Diamant-Emoji auf gleicher Größe
            wie die 28px Resource-Icons. */}
        <div style={{
          display: "flex", gap: 0, pointerEvents: "auto",
          padding: "0 1px", borderRadius: 8,
          background: "rgba(15,17,21,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}>
          <ResChip art={resourceArt} kind="wood"  fallback="🔩" value={data?.resources.wood  ?? 0} title="Tech-Schrott" color="#FFD700" />
          <ResChip art={resourceArt} kind="stone" fallback="⚙️" value={data?.resources.stone ?? 0} title="Komponenten" color="#9aa3b8" />
          <ResChip art={resourceArt} kind="gold"  fallback="💰" value={data?.resources.gold  ?? 0} title="Krypto"      color="#FFD700" />
          <ResChip art={resourceArt} kind="mana"  fallback="📡" value={data?.resources.mana  ?? 0} title="Bandbreite"  color="#22D1C3" />
          {/* Diamanten + Aufladen-Button */}
          <button
            onClick={onGemsClick}
            style={{
              ...btnReset, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 1,
              padding: "0 1px",
              background: "transparent", border: "none",
              color: "#5ddaf0", fontSize: 11, fontWeight: 900,
              fontFamily: "Inter,-apple-system,sans-serif",
              marginLeft: 0,
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            }}
            aria-label="Diamanten — Aufladen"
            title="Diamanten — Aufladen"
          >
            <span style={{
              fontSize: 16, lineHeight: 1,
              display: "inline-block", verticalAlign: "middle",
              transform: "translateY(-3px)",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
            }}>💎</span>
            <span>{fmtCompact(data?.gems ?? 0)}</span>
            <span style={{
              background: "#FF2D78", color: "#FFF",
              fontSize: 10, fontWeight: 900,
              width: 14, height: 14, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.7)",
              marginLeft: 1,
            }}>+</span>
          </button>
        </div>

        {/* Aktions-Buttons */}
        <div style={{ display: "flex", gap: 4, pointerEvents: "auto" }}>
          {/* Shop — prominent: nutzt das quick_shop-Artwork (Geschenk-Box mit
              gold/magenta-Schleife) aus der ehemaligen Quick-Access-Bar. Etwas
              größer als die anderen HUD-Buttons, weil der zentrale Monetisierungs-
              Hook. onDealsClick + onShopClick gehen ohnehin beide in denselben
              Gem-Shop, darum nur noch ein Eintrag. */}
          <HudActionBtn icon="🎁" label="Shop" color="#FF2D78" onClick={onShopClick ?? onDealsClick} slot="quick_shop" art={uiIconArt} size={52} />
          <HudActionBtn icon="⚔️" label="CvC" color="#FFD700" onClick={onCvcClick} />
        </div>
      </div>

      {/* Tageszeit + Wetter-Banner — oben in der Mitte zwischen Avatar-Spalte
          links und Resource-Bar rechts. */}
      <TimeWeatherBanner />

      {/* Atmosphäre-Layer: Tageszeit-Tönung + Wetter-Partikel + Sound-Toggle.
          pointer-events: none, beeinflusst Map-Interaktion nicht. */}
      <WeatherAtmosphereOverlay />

      {/* Quest-Teaser — kleines Hinweis-Element rechts neben dem Quest-Icon.
          Zeigt die nächst erreichbare Quest. Klick öffnet das volle Modal. */}
      <QuestTeaser
        onClick={() => onQuestsClick?.()}
        hidden={questsOpen}
        reloadKey={questReloadKey}
      />
    </>
  );
}

const btnReset: CSSProperties = {
  border: "none", background: "transparent", padding: 0, font: "inherit", color: "inherit", cursor: "pointer",
};

function ResChip({ art, kind, fallback, value, title, color }: { art: ResourceArtMap; kind: ResourceKind; fallback: string; value: number; title: string; color: string }) {
  return (
    <div
      title={title}
      style={{
        display: "flex", alignItems: "center", gap: 1,
        padding: "0 1px",
        fontSize: 11, fontWeight: 900, color: "#FFF",
        fontFamily: "Inter,-apple-system,sans-serif",
      }}
    >
      <ResourceIcon kind={kind} fallback={fallback} art={art} size={22} />
      <span style={{ color }}>{fmtCompact(value)}</span>
    </div>
  );
}

function HudActionBtn({ icon, label, color, onClick, slot, art, size = 44 }: {
  icon: string;
  label: string;
  color: string;
  onClick?: () => void;
  /** Optional: cosmetic_artwork-Slot (z.B. "quick_shop"). Wenn Artwork vorhanden,
   *  wird es statt des Emoji-Icons gerendert. */
  slot?: string;
  art?: import("@/components/resource-icon").ResourceArtMap;
  size?: number;
}): ReactNode {
  const hasArt = !!(slot && art && (art[slot]?.image_url || art[slot]?.video_url));
  return (
    <button
      onClick={onClick}
      style={{
        ...btnReset,
        display: "flex", alignItems: "center", justifyContent: "center",
        width: size, height: size,
        background: "transparent",
        border: "none",
        cursor: "pointer", color,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
      }}
      aria-label={label}
      title={label}
    >
      {hasArt && slot ? (
        <UiIcon slot={slot} fallback={icon} art={art!} size={size} />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.59), lineHeight: 1 }}>{icon}</span>
      )}
    </button>
  );
}

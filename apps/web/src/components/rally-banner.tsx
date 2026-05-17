"use client";

/**
 * RallyBanner — kompakte Status-Pille fuer aktive Crew-Angriffe (Wegelager
 * UND Mutanten). Sitzt unter dem Wetter-Banner, oben mittig auf der Karte.
 * Zeigt Status (Vorbereitung / Streifzug / Kampf), Countdown und gesamten
 * Angriffswert. Click → onOpen (z.B. Map-FlyTo zum Target oder Modal).
 *
 * Vorher in stronghold-modal.tsx — ausgelagert weil der Banner inzwischen
 * fuer beide Target-Typen genutzt wird (Wegelager + Mutant).
 */

import { useEffect, useState } from "react";
import { useStrongholdArt } from "@/components/resource-icon";

export type ActiveRally = {
  id: string;
  prep_ends_at: string;
  march_ends_at: string | null;
  /** Mutant-Rally: Ende der Fight-Phase (= Start des Rückwegs). */
  fight_ends_at?: string | null;
  /** Mutant-Rally: Ende des Rückwegs (50% Speed-Boost). */
  return_ends_at?: string | null;
  status: "preparing" | "marching" | "fighting" | "returning" | "done" | "aborted";
  total_atk: number;
};

export function ActiveRallyBanner({ rally, onOpen, onDismiss }: {
  rally: ActiveRally | null;
  onOpen: () => void;
  /** Optional: X-Button zum manuellen Wegklicken (z.B. wenn der Banner stoert). */
  onDismiss?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!rally) return null;

  // Countdown-Target je Phase — bei Mutanten zusätzlich fight_ends_at und
  // return_ends_at, damit Kampf-/Rückweg-Phase eigene Restzeit anzeigen.
  const target =
    rally.status === "preparing"
      ? new Date(rally.prep_ends_at).getTime()
      : rally.status === "fighting" && rally.fight_ends_at
        ? new Date(rally.fight_ends_at).getTime()
        : rally.status === "returning" && rally.return_ends_at
          ? new Date(rally.return_ends_at).getTime()
          : rally.march_ends_at
            ? new Date(rally.march_ends_at).getTime()
            : 0;
  const remain = Math.max(0, target - now);
  const hh = Math.floor(remain / 3600000);
  const mm = Math.floor((remain % 3600000) / 60000);
  const ss = Math.floor((remain % 60000) / 1000);
  const countdown = hh > 0
    ? `${hh}h ${String(mm).padStart(2, "0")}m`
    : `${mm}:${String(ss).padStart(2, "0")}`;

  const statusColor =
    rally.status === "preparing" ? "#FFD700"
    : rally.status === "marching" ? "#FF6B4A"
    : rally.status === "returning" ? "#22D1C3"
    : "#FF2D78";
  const statusText =
    rally.status === "preparing" ? "⏳ Vorbereitung"
    : rally.status === "marching" ? "🏃 Streifzug"
    : rally.status === "returning" ? "🏠 Rückweg (Speed-Boost)"
    : "⚔️ Kampf";

  return (
    <RallyBannerInner
      rally={rally}
      statusColor={statusColor}
      statusText={statusText}
      countdown={countdown}
      onOpen={onOpen}
      onDismiss={onDismiss}
    />
  );
}

function RallyBannerInner({ rally, statusColor, statusText, countdown, onOpen, onDismiss }: {
  rally: ActiveRally;
  statusColor: string;
  statusText: string;
  countdown: string;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  const strongholdArt = useStrongholdArt();
  // Wir haben hier nur ein generisches Rally-Objekt — fuer beide Target-Typen
  // (Stronghold + Mutant) nehmen wir denselben Default-Icon-Slot.
  const art = strongholdArt.default;
  return (
    <div
      className="w-full px-2 py-1 rounded-lg flex items-center gap-1.5 backdrop-blur"
      style={{
        background: `linear-gradient(135deg, ${statusColor}33, rgba(15,17,21,0.85))`,
        border: `1px solid ${statusColor}77`,
      }}
    >
      <button onClick={onOpen} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
        {art?.video_url ? (
          <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 20, height: 20, objectFit: "contain" }} />
        ) : art?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art.image_url} alt="rally" style={{ width: 20, height: 20, objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 16 }}>⚔️</span>
        )}
        <div className="flex-1 leading-tight min-w-0">
          <div className="text-[8px] font-black tracking-widest truncate" style={{ color: statusColor }}>
            CREW-ANGRIFF · {statusText}
          </div>
          <div className="text-[10px] font-black text-white truncate">
            {countdown} · {rally.total_atk.toLocaleString("de-DE")} Angriff
          </div>
        </div>
        <span className="text-white text-sm">›</span>
      </button>
      {onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label="Banner schliessen"
          title="Banner schliessen"
          className="shrink-0 w-5 h-5 rounded-full bg-black/40 text-white text-xs leading-none ml-1"
        >
          ×
        </button>
      )}
    </div>
  );
}

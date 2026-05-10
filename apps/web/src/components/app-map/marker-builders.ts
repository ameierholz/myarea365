// Pure DOM marker-builder helpers, extrahiert aus app-map.tsx zwecks
// Bundle-Splitting + Wartbarkeit. Keine React-Hooks, kein Module-State —
// reines `document.createElement` plus `el.innerHTML`.
//
// Alle drei Builder werden von <AppMap> in useEffect-Schleifen pro Marker
// einmal aufgerufen, danach werden die Elements von Mapbox-Markers verwaltet.

import type { MapRunner, SupplyDrop } from "@/lib/game-config";

// Eigenes Marker-DOM (Emoji mit Glow)
export function buildSelfMarkerEl(
  emoji: string, color: string, isRunning: boolean,
  supporterTier?: "bronze" | "silver" | "gold" | null,
  auraActive = false,
  crewColor?: string | null, crewName?: string | null,
  displayName?: string | null,
  markerArt?: { image_url: string | null; video_url: string | null } | null,
): HTMLDivElement {
  const size = isRunning ? 50 : 44;
  const glow = isRunning ? 28 : 18;
  const el = document.createElement("div");
  // Klasse NICHT auf el — sonst kleben Theme-Pseudoelemente (::before/::after) am
  // OUTER-el und skalieren nicht mit dem Zoom-Wrap. wrapForZoomScale verschiebt
  // die Klasse auf den inner-Wrap (siehe dort).
  el.dataset.runnerPinHost = "1";
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;width:${size + 20}px;height:${size + 20}px;pointer-events:none`;
  const tierCfg = supporterTier === "gold"
    ? { bg: "linear-gradient(135deg,#FFD700,#B8860B)", border: "#FFD700", icon: "★", shadow: "0 0 10px #FFD700cc" }
    : supporterTier === "silver"
      ? { bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", border: "#C0C0C0", icon: "★", shadow: "0 0 8px #C0C0C0cc" }
      : supporterTier === "bronze"
        ? { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", border: "#CD7F32", icon: "★", shadow: "0 0 8px #CD7F32cc" }
        : null;
  // Chip sitzt oben-rechts klar AUSSERHALB des Kreises
  const supporterChip = tierCfg
    ? `<div style="position:absolute;top:-10px;right:-10px;width:20px;height:20px;border-radius:50%;background:${tierCfg.bg};border:2px solid ${tierCfg.border};display:flex;align-items:center;justify-content:center;font-size:11px;color:#0F1115;font-weight:900;box-shadow:${tierCfg.shadow};z-index:3">${tierCfg.icon}</div>`
    : "";
  // Name-Badge (frosted glass, crew-color border glow, Speech-Bubble-Pfeil, klickbar)
  const cleanName = (displayName ?? "").trim();
  const badgeColor = crewColor ?? "#22D1C3";
  const nameLabel = cleanName
    ? `<div class="ma365-runner-badge" data-action="open-runner-profile"
            title="${crewName ? "Crew: " + crewName + " · Klick öffnet dein Runner-Profil" : "Klick öffnet dein Runner-Profil"}"
            style="--badge-color:${badgeColor}"
            onclick="event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('ma365:open-runner-profile'));"
            onmousedown="event.stopPropagation();"
            ontouchstart="event.stopPropagation();"
       >
        ${crewColor ? `<span class="ma365-runner-badge-dot" style="background:${crewColor}"></span>` : ""}
        <span class="ma365-runner-badge-at">@</span><span class="ma365-runner-badge-name">${cleanName}</span>
       </div>`
    : "";
  const auraLayer = auraActive
    ? `<div style="position:absolute;width:${size + 28}px;height:${size + 28}px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700 0deg,#22D1C3 120deg,#FF2D78 240deg,#FFD700 360deg);opacity:0.35;filter:blur(6px);animation:auraSpin 4s linear infinite"></div>
       <div style="position:absolute;width:${size + 14}px;height:${size + 14}px;border-radius:50%;border:2px solid #FFD700aa;box-shadow:0 0 20px #FFD700cc;animation:auraPulse 2s ease-in-out infinite"></div>`
    : "";
  el.innerHTML = `
    ${auraLayer}
    <div class="runner-ring" style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color}25;box-shadow:0 0 ${glow}px ${color}cc;${isRunning ? "animation:selfPulse 1.5s ease-in-out infinite" : ""}"></div>
    ${markerArt?.video_url
      ? `<video class="runner-emoji" src="${markerArt.video_url}" autoplay loop muted playsinline style="position:relative;width:${isRunning ? 50 : 44}px;height:${isRunning ? 50 : 44}px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)"></video>`
      : markerArt?.image_url
        ? `<img class="runner-emoji" src="${markerArt.image_url}" alt="" style="position:relative;width:${isRunning ? 50 : 44}px;height:${isRunning ? 50 : 44}px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)" />`
        : `<span class="runner-emoji" style="position:relative;font-size:${isRunning ? 40 : 34}px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)">${emoji}</span>`
    }
    ${supporterChip}
    ${nameLabel}
    <style>
      @keyframes selfPulse{0%,100%{transform:scale(1);opacity:0.95}50%{transform:scale(1.15);opacity:0.5}}
      @keyframes auraSpin{to{transform:rotate(360deg)}}
      @keyframes auraPulse{0%,100%{transform:scale(1);opacity:0.9}50%{transform:scale(1.1);opacity:0.5}}
    </style>
  `;
  // Click-Handler direkt an der Node. Mapbox ruft auf Marker-mousedown teils
  // preventDefault auf, was das folgende `click`-Event unterdruecken kann.
  // Deshalb feuern wir bereits auf pointerdown/mouseup — nicht nur auf click.
  const badgeEl = el.querySelector(".ma365-runner-badge") as HTMLElement | null;
  if (badgeEl) {
    let fired = false;
    const fire = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      (ev as Event).stopImmediatePropagation?.();
      if (fired) return;
      fired = true;
      setTimeout(() => { fired = false; }, 500);
      window.dispatchEvent(new CustomEvent("ma365:open-runner-profile"));
    };
    badgeEl.addEventListener("pointerdown", fire);
    badgeEl.addEventListener("mouseup", fire);
    badgeEl.addEventListener("click", fire);
    badgeEl.addEventListener("touchend", fire, { passive: false });
  }
  return el;
}

export function buildRunnerMarkerEl(r: MapRunner): HTMLDivElement {
  const isCrew = r.is_crew_member;
  const size = isCrew ? 50 : 42;
  const iconSize = isCrew ? 28 : 24;
  const el = document.createElement("div");
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;width:${size + 12}px;height:${size + 12}px`;

  const crewRing = isCrew
    ? `<div style="position:absolute;width:${size - 2}px;height:${size - 2}px;border-radius:50%;border:2.5px solid ${r.color};box-shadow:0 0 14px ${r.color}aa, inset 0 0 8px ${r.color}44"></div>`
    : "";
  const crewStar = isCrew
    ? `<div style="position:absolute;top:-5px;right:-5px;width:19px;height:19px;border-radius:50%;background:${r.color};border:1.5px solid #0F1115;display:flex;align-items:center;justify-content:center;font-size:10px;color:#0F1115;box-shadow:0 0 8px ${r.color};z-index:2">★</div>`
    : "";
  const walkRipple = r.is_walking
    ? `<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${r.color}cc;animation:runnerRipple 1.6s ease-out infinite"></div>`
    : "";
  const walkBadge = r.is_walking
    ? `<div style="position:absolute;bottom:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#0F1115;border:1.5px solid #4ade80;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 10px #4ade80aa;animation:runnerBob 0.6s ease-in-out infinite alternate;z-index:2">🏃</div>`
    : "";

  el.innerHTML = `
    ${walkRipple}
    ${crewRing}
    <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, ${r.color}55, ${r.color}22);border:1px solid ${r.color}88;box-shadow:0 0 12px ${r.color}88, inset 0 0 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center">
      <span style="font-size:${iconSize}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 6px ${r.color}88)">${r.marker_icon}</span>
    </div>
    ${crewStar}
    ${walkBadge}
    <style>
      @keyframes runnerRipple{0%{transform:scale(1);opacity:0.8}100%{transform:scale(1.8);opacity:0}}
      @keyframes runnerBob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
    </style>
  `;
  return el;
}

export function buildDropMarkerEl(drop: SupplyDrop): HTMLDivElement {
  const rarityColor: Record<string, string> = {
    common: "#9ba8c7", rare: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
  };
  const color = rarityColor[drop.rarity] || "#5ddaf0";
  const el = document.createElement("div");
  el.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;width:56px;height:56px;cursor:pointer";
  el.innerHTML = `
    <div style="position:absolute;width:50px;height:50px;border-radius:50%;background:${color}25;box-shadow:0 0 22px ${color}cc;animation:dropPulse 1.6s ease-in-out infinite"></div>
    <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 12px rgba(255,255,255,0.4)">
      <span style="font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">🎁</span>
    </div>
    <style>@keyframes dropPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.5}}</style>
  `;
  return el;
}

// Zentrale App-Präferenzen mit Side-Effects.
// Alle Keys persistieren in localStorage. applyPref() wendet UI/Runtime-Effekte an.
// Aufruf applyAllPrefs() einmalig beim App-Boot (siehe providers.tsx).

export type PrefKey =
  // Darstellung
  | "display_theme" | "display_accent" | "display_font" | "display_animations" | "display_reduced_motion"
  | "display_mapstyle" | "display_3d"
  // Sound / Haptik
  | "sound_achievement" | "sound_haptics" | "sound_music"
  // Tracking
  | "track_wakelock" | "track_snap" | "track_autostart" | "track_gps"
  | "track_pace_announce" | "track_voice" | "track_pace_interval"
  // Push / Ruhe
  | "notif_push" | "notif_quiet_mode" | "notif_quiet_start" | "notif_quiet_end"
  | "notif_crew_chat" | "notif_crew_events" | "notif_duels" | "notif_achievements"
  | "notif_rank_up" | "notif_shop_deals" | "notif_streak_warn"
  // E-Mail / Ads / Beta
  | "email_weekly" | "email_monthly" | "email_newsletter" | "email_flash_deals"
  | "ads_personalized" | "ads_anon_stats" | "app_beta"
  // Privatsphäre (lokal gespiegelt, echte Policies via DB später)
  | "privacy_leaderboard" | "privacy_live_crew" | "privacy_territories"
  | "privacy_routes" | "privacy_searchable" | "privacy_crew_invites" | "privacy_friends"
  // Performance
  | "perf_data" | "perf_preload" | "perf_bg_sync" | "perf_offline";

const DEFAULTS: Record<string, string | boolean> = {
  display_theme: "dark", display_accent: "teal", display_font: "normal",
  display_animations: true, display_reduced_motion: false,
  display_mapstyle: "standard", display_3d: true,
  sound_achievement: true, sound_haptics: true, sound_music: false,
  track_wakelock: true, track_snap: true, track_autostart: false, track_gps: "high",
  track_pace_announce: false, track_voice: "female", track_pace_interval: "1",
  notif_push: true, notif_quiet_mode: true, notif_quiet_start: "22", notif_quiet_end: "7",
  notif_crew_chat: true, notif_crew_events: true, notif_duels: true, notif_achievements: true,
  notif_rank_up: true, notif_shop_deals: true, notif_streak_warn: true,
  email_weekly: false, email_monthly: true, email_newsletter: false, email_flash_deals: false,
  ads_personalized: true, ads_anon_stats: true, app_beta: false,
  privacy_leaderboard: true, privacy_live_crew: true, privacy_territories: true,
  privacy_routes: false, privacy_searchable: true, privacy_crew_invites: true, privacy_friends: true,
  perf_data: "full", perf_preload: true, perf_bg_sync: true, perf_offline: false,
};

export function getPref<T extends string | boolean>(key: PrefKey, fallback?: T): T {
  if (typeof window === "undefined") return (fallback ?? DEFAULTS[key]) as T;
  try {
    const raw = localStorage.getItem(`pref:${key}`);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {}
  return (fallback ?? DEFAULTS[key]) as T;
}

export function setPref(key: PrefKey, value: string | boolean): void {
  try { localStorage.setItem(`pref:${key}`, JSON.stringify(value)); } catch {}
  applyPref(key, value);
  // Cross-component Broadcast
  try { window.dispatchEvent(new CustomEvent("pref-change", { detail: { key, value } })); } catch {}
}

const ACCENTS: Record<string, string> = {
  teal: "#22D1C3", pink: "#FF2D78", gold: "#FFD700", violet: "#a855f7",
};

const FONT_SCALE: Record<string, string> = {
  small: "14px", normal: "16px", large: "18px", xlarge: "20px",
};

export function applyPref(key: PrefKey, value: string | boolean): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;

  switch (key) {
    case "display_theme": {
      const t = value as string;
      const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      html.classList.toggle("dark", dark);
      html.classList.toggle("light", !dark);
      html.setAttribute("data-theme", dark ? "dark" : "light");
      break;
    }
    case "display_accent": {
      const hex = ACCENTS[value as string] || ACCENTS.teal;
      html.style.setProperty("--accent", hex);
      html.style.setProperty("--color-primary", hex);
      break;
    }
    case "display_font": {
      html.style.fontSize = FONT_SCALE[value as string] || FONT_SCALE.normal;
      break;
    }
    case "display_animations": {
      html.classList.toggle("no-animations", !value);
      break;
    }
    case "display_reduced_motion": {
      html.classList.toggle("reduced-motion", !!value);
      break;
    }
    case "sound_haptics":
    case "sound_achievement":
    case "sound_music":
    case "track_wakelock":
    case "track_snap":
    case "track_autostart":
    case "track_gps":
    case "track_pace_announce":
    case "track_voice":
    case "track_pace_interval":
    case "display_mapstyle":
    case "display_3d":
    case "notif_push":
    case "notif_quiet_mode":
    case "notif_quiet_start":
    case "notif_quiet_end":
    case "notif_crew_chat":
    case "notif_crew_events":
    case "notif_duels":
    case "notif_achievements":
    case "notif_rank_up":
    case "notif_shop_deals":
    case "notif_streak_warn":
    case "email_weekly":
    case "email_monthly":
    case "email_newsletter":
    case "email_flash_deals":
    case "ads_personalized":
    case "ads_anon_stats":
    case "app_beta":
    case "privacy_leaderboard":
    case "privacy_live_crew":
    case "privacy_territories":
    case "privacy_routes":
    case "privacy_searchable":
    case "privacy_crew_invites":
    case "privacy_friends":
    case "perf_data":
    case "perf_preload":
    case "perf_bg_sync":
    case "perf_offline":
      // Zur Laufzeit per getPref() / Event abgefragt.
      if (key === "app_beta") html.classList.toggle("beta-features", !!value);
      if (key === "perf_data") html.setAttribute("data-save", value === "saver" ? "1" : "0");
      break;
  }
}

export function applyAllPrefs(): void {
  (Object.keys(DEFAULTS) as PrefKey[]).forEach((k) => {
    applyPref(k, getPref(k));
  });
  // System-Theme-Änderung live folgen
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getPref<string>("display_theme") === "system") applyPref("display_theme", "system");
    });
  } catch {}
}

// ── Laufzeit-Helpers ─────────────────────────────────────────

export function vibrate(pattern: number | number[]): void {
  if (!getPref<boolean>("sound_haptics")) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

let audioCtx: AudioContext | null = null;
export function playAchievementSound(): void {
  if (!getPref<boolean>("sound_achievement")) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx!;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.12);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.32);
    });
  } catch {}
}

export function speakPace(distanceKm: number, durationS: number): void {
  if (!getPref<boolean>("track_pace_announce")) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const interval = parseFloat(getPref<string>("track_pace_interval") || "1");
  if (distanceKm < interval || distanceKm % interval > 0.05) return; // nur bei km-Markern

  const paceSec = durationS / distanceKm;
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec - m * 60);
  const text = `Nach ${distanceKm.toFixed(0)} Kilometern. Pace ${m} Minuten ${s} Sekunden.`;
  const voice = getPref<string>("track_voice");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  const voices = window.speechSynthesis.getVoices();
  const deVoices = voices.filter((v) => v.lang.startsWith("de"));
  if (voice === "female") u.voice = deVoices.find((v) => /female|anna|petra/i.test(v.name)) || deVoices[0];
  else if (voice === "male") u.voice = deVoices.find((v) => /male|markus|stefan/i.test(v.name)) || deVoices[0];
  else u.voice = deVoices[0];
  window.speechSynthesis.speak(u);
}

export function isInQuietHours(): boolean {
  if (!getPref<boolean>("notif_quiet_mode")) return false;
  const start = parseInt(getPref<string>("notif_quiet_start") || "22", 10);
  const end = parseInt(getPref<string>("notif_quiet_end") || "7", 10);
  const h = new Date().getHours();
  return start < end ? h >= start && h < end : h >= start || h < end;
}

export function canShowNotif(channel:
  | "crew_chat" | "crew_events" | "duels" | "achievements"
  | "rank_up" | "shop_deals" | "streak_warn"
): boolean {
  if (!getPref<boolean>("notif_push")) return false;
  if (isInQuietHours()) return false;
  return getPref<boolean>(`notif_${channel}` as PrefKey);
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function showLocalNotif(title: string, body: string, channel:
  | "crew_chat" | "crew_events" | "duels" | "achievements"
  | "rank_up" | "shop_deals" | "streak_warn"
): void {
  if (!canShowNotif(channel)) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/logo.png" }); } catch {}
}

export function geolocationOptions(): PositionOptions {
  const mode = getPref<string>("track_gps");
  if (mode === "low") return { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 };
  if (mode === "balanced") return { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };
  return { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 };
}

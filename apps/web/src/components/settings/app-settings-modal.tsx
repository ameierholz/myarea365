"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { createClient } from "@/lib/supabase/client";
import { UNITS } from "@/lib/game-config";

const PRIMARY = "#22D1C3";

export interface SettingsProfile {
  username?: string;
  display_name?: string | null;
  setting_units?: string;
  setting_privacy_public?: boolean;
  setting_auto_pause?: boolean;
  setting_sound?: boolean;
}

/* ─── Primitive Settings-UI-Bausteine ─────────────────────────────────── */

function SettingRow({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const labelId = React.useId();
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    }}>
      <span id={labelId} style={{ color: "#FFF", fontSize: 15 }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          // Space/Enter toggeln bereits per Default; Pfeil-Tasten zusätzlich
          if (e.key === "ArrowLeft") { e.preventDefault(); onChange(false); }
          if (e.key === "ArrowRight") { e.preventDefault(); onChange(true); }
        }}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: checked ? PRIMARY : "rgba(255, 255, 255, 0.1)",
          border: "2px solid transparent",
          cursor: "pointer",
          position: "relative", transition: "background 0.2s",
          outlineOffset: 2,
        }}
      >
        <span aria-hidden="true" style={{
          position: "absolute", top: 1, left: checked ? 20 : 1,
          width: 20, height: 20, borderRadius: 10,
          background: "#FFF", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

function SettingSelect({ label, value, options, onChange, last }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; last?: boolean }) {
  const id = React.useId();
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    }}>
      <label htmlFor={id} style={{ color: "#FFF", fontSize: 15 }}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "rgba(255, 255, 255, 0.1)", color: "#FFF", border: "none",
          padding: "6px 12px", borderRadius: 8, fontSize: 13,
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} style={{ background: "#1A1D23", color: "#FFF" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SettingsGroup({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const panelId = React.useId();
  const headerId = React.useId();
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 14,
          background: "rgba(70, 82, 122, 0.55)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#FFF", fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span>{title}</span>
        <span aria-hidden="true" style={{ fontSize: 14, color: "#a8b4cf", transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        style={open ? {
          background: "rgba(70, 82, 122, 0.35)", borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.08)", marginTop: 4,
        } : undefined}
      >
        {open && children}
      </div>
    </div>
  );
}

function SettingAction({ label, value, onClick, danger, last }: { label: string; value?: string; onClick: () => void; danger?: boolean; last?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
      color: danger ? "#ef7169" : "#FFF",
    }}>
      <span style={{ fontSize: 15 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#a8b4cf" }}>{value ?? "›"}</span>
    </button>
  );
}

function useLocalPref<T extends string | boolean>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pref:${key}`);
      if (raw !== null) setV(JSON.parse(raw) as T);
    } catch {}
  }, [key]);
  const set = (val: T) => {
    setV(val);
    import("@/lib/prefs").then(({ setPref }) => setPref(key as never, val));
  };
  return [v, set];
}

/* ─── Hauptkomponente ─────────────────────────────────────────────────── */

export function AppSettingsContent({ p, updateSetting, onExportData, onLogout }: {
  p: SettingsProfile | null;
  updateSetting: (key: string, value: boolean | string) => Promise<void>;
  onExportData: () => void;
  onLogout: () => void;
}) {
  const tMD = useTranslations("MapDashboard");

  // Profil: Anzeigename
  const initialName = (p?.display_name ?? p?.username ?? "").trim();
  const isFirstNameSet = !p?.display_name?.trim();
  const RENAME_COST = 500;
  const [displayName, setDisplayName] = useState<string>(initialName);
  const [renameBusy, setRenameBusy] = useState(false);
  type Avail = { state: "idle" | "checking" | "free" | "taken" | "invalid" | "self"; reason?: string };
  const [avail, setAvail] = useState<Avail>({ state: "idle" });
  const trimmedName = displayName.trim();
  const nameDirty = trimmedName !== initialName;
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 15;

  // Debounced Live-Check ob Name frei ist
  useEffect(() => {
    if (!nameDirty || !nameValid) {
      setAvail({ state: nameValid ? "idle" : "invalid" });
      return;
    }
    setAvail({ state: "checking" });
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/account/rename/check?name=${encodeURIComponent(trimmedName)}`, {
          signal: ctl.signal, cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean; available?: boolean; valid?: boolean; self?: boolean; reason?: string };
        if (!j.ok) return;
        if (!j.valid) setAvail({ state: "invalid", reason: j.reason });
        else if (j.self) setAvail({ state: "self" });
        else setAvail({ state: j.available ? "free" : "taken" });
      } catch { /* aborted */ }
    }, 350);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [trimmedName, nameDirty, nameValid]);

  const saveDisplayName = async () => {
    if (!isFirstNameSet) {
      const ok = await appConfirm({
        title: "Namen ändern",
        message: `Das Ändern deines Anzeigenamens kostet ${RENAME_COST} Edelsteine. Fortfahren?`,
        danger: false,
        confirmLabel: `Für ${RENAME_COST}💎 ändern`,
      });
      if (!ok) return;
    }
    setRenameBusy(true);
    try {
      const r = await fetch("/api/account/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmedName }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; message?: string; cost?: number };
      if (!j.ok) appAlert(j.message ?? j.error ?? "Fehler");
      else appAlert(j.cost ? `Name geändert (−${j.cost}💎)` : "Name geändert");
    } catch { appAlert("Netzwerkfehler"); }
    finally { setRenameBusy(false); }
  };

  // Benachrichtigungen
  const [pushEnabled, setPushEnabled] = useLocalPref<boolean>("notif_push", true);
  const [notifCrewChat, setNotifCrewChat] = useLocalPref<boolean>("notif_crew_chat", true);
  const [notifCrewEvents, setNotifCrewEvents] = useLocalPref<boolean>("notif_crew_events", true);
  const [notifDuels, setNotifDuels] = useLocalPref<boolean>("notif_duels", true);
  const [notifAchievements, setNotifAchievements] = useLocalPref<boolean>("notif_achievements", true);
  const [notifRankUp, setNotifRankUp] = useLocalPref<boolean>("notif_rank_up", true);
  const [notifShopDeals, setNotifShopDeals] = useLocalPref<boolean>("notif_shop_deals", true);
  const [notifStreakWarn, setNotifStreakWarn] = useLocalPref<boolean>("notif_streak_warn", true);
  const [notifQuietMode, setNotifQuietMode] = useLocalPref<boolean>("notif_quiet_mode", true);
  const [quietStart, setQuietStart] = useLocalPref<string>("notif_quiet_start", "22");
  const [quietEnd, setQuietEnd] = useLocalPref<string>("notif_quiet_end", "7");

  // E-Mail
  const [emailWeekly, setEmailWeekly] = useLocalPref<boolean>("email_weekly", false);
  const [emailMonthly, setEmailMonthly] = useLocalPref<boolean>("email_monthly", true);
  const [emailNewsletter, setEmailNewsletter] = useLocalPref<boolean>("email_newsletter", false);
  const [emailFlashDeals, setEmailFlashDeals] = useLocalPref<boolean>("email_flash_deals", false);

  // Privatsphäre
  const [leaderboardVisible, setLeaderboardVisible] = useLocalPref<boolean>("privacy_leaderboard", true);
  const [liveLocationCrew, setLiveLocationCrew] = useLocalPref<boolean>("privacy_live_crew", true);
  const [publicTerritories, setPublicTerritories] = useLocalPref<boolean>("privacy_territories", true);
  const [publicRoutes, setPublicRoutes] = useLocalPref<boolean>("privacy_routes", false);
  const [searchable, setSearchable] = useLocalPref<boolean>("privacy_searchable", true);
  const [allowCrewInvites, setAllowCrewInvites] = useLocalPref<boolean>("privacy_crew_invites", true);
  const [allowFriends, setAllowFriends] = useLocalPref<boolean>("privacy_friends", true);

  // Tracking & Lauf
  const [gpsAccuracy, setGpsAccuracy] = useLocalPref<string>("track_gps", "high");
  const [snapToRoads, setSnapToRoads] = useLocalPref<boolean>("track_snap", true);
  const [wakeLock, setWakeLock] = useLocalPref<boolean>("track_wakelock", true);
  const [paceAnnounce, setPaceAnnounce] = useLocalPref<boolean>("track_pace_announce", false);
  const [paceVoice, setPaceVoice] = useLocalPref<string>("track_voice", "female");
  const [paceInterval, setPaceInterval] = useLocalPref<string>("track_pace_interval", "1");
  const [autoStart, setAutoStart] = useLocalPref<boolean>("track_autostart", false);

  // Darstellung
  const [theme, setTheme] = useLocalPref<string>("display_theme", "dark");
  const [mapStyle, setMapStyle] = useLocalPref<string>("display_mapstyle", "standard");
  const [buildings3d, setBuildings3d] = useLocalPref<boolean>("display_3d", true);
  const [reducedMotion, setReducedMotion] = useLocalPref<boolean>("display_reduced_motion", false);
  const [animations, setAnimations] = useLocalPref<boolean>("display_animations", true);
  const [fontSize, setFontSize] = useLocalPref<string>("display_font", "normal");
  const [accentColor, setAccentColor] = useLocalPref<string>("display_accent", "teal");

  // Sound & Haptik
  const [musicDuringRun, setMusicDuringRun] = useLocalPref<boolean>("sound_music", false);
  const [haptics, setHaptics] = useLocalPref<boolean>("sound_haptics", true);
  const [achievementSound, setAchievementSound] = useLocalPref<boolean>("sound_achievement", true);

  // Performance
  const [dataMode, setDataMode] = useLocalPref<string>("perf_data", "full");
  const [mapPreload, setMapPreload] = useLocalPref<boolean>("perf_preload", true);
  const [backgroundSync, setBackgroundSync] = useLocalPref<boolean>("perf_bg_sync", true);
  const [offlineMode, setOfflineMode] = useLocalPref<boolean>("perf_offline", false);

  // Werbung
  const [personalizedDeals, setPersonalizedDeals] = useLocalPref<boolean>("ads_personalized", true);
  const [anonymousStats, setAnonymousStats] = useLocalPref<boolean>("ads_anon_stats", true);

  // Beta
  const [betaFeatures, setBetaFeatures] = useLocalPref<boolean>("app_beta", false);

  const sb = createClient();

  return (
    <>
      <SettingsGroup title="👤 PROFIL" defaultOpen>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 6 }}>
            Runner-Anzeigename (2–15 Zeichen)
            {!isFirstNameSet && (
              <span style={{ color: "#FFD700", fontWeight: 700, marginLeft: 6 }}>· Kosten: {RENAME_COST}💎</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={displayName}
              maxLength={15}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dein Name"
              aria-label="Anzeigename"
              aria-describedby="rename-status"
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 10,
                background: "rgba(0,0,0,0.3)", color: "#FFF",
                border: `1px solid ${
                  avail.state === "taken" ? "#FF2D78"
                  : avail.state === "free"  ? "#22D1C3"
                  : "rgba(255,255,255,0.1)"
                }`,
                fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={() => void saveDisplayName()}
              disabled={renameBusy || !nameDirty || !nameValid || avail.state === "checking" || avail.state === "taken"}
              style={{
                padding: "0 16px", borderRadius: 10,
                background: "rgba(34,209,195,0.2)", color: "#22D1C3",
                border: "1px solid rgba(34,209,195,0.4)", fontWeight: 700, fontSize: 13,
                cursor: (renameBusy || !nameDirty || !nameValid || avail.state === "checking" || avail.state === "taken") ? "not-allowed" : "pointer",
                opacity: (renameBusy || !nameDirty || !nameValid || avail.state === "checking" || avail.state === "taken") ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >{renameBusy ? "…" : isFirstNameSet ? "Speichern" : `${RENAME_COST}💎`}</button>
          </div>
          <div id="rename-status" aria-live="polite" style={{ minHeight: 18, marginTop: 6, fontSize: 11, fontWeight: 600 }}>
            {!nameDirty && <span style={{ color: "#a8b4cf" }}>&nbsp;</span>}
            {nameDirty && !nameValid && <span style={{ color: "#FF2D78" }}>Name muss 2–15 Zeichen sein</span>}
            {nameDirty && nameValid && avail.state === "checking" && <span style={{ color: "#a8b4cf" }}>Prüfe Verfügbarkeit…</span>}
            {nameDirty && avail.state === "free"  && <span style={{ color: "#22D1C3" }}>✓ Name ist frei</span>}
            {nameDirty && avail.state === "taken" && <span style={{ color: "#FF2D78" }}>✗ Name ist bereits vergeben</span>}
            {nameDirty && avail.state === "self"  && <span style={{ color: "#a8b4cf" }}>Das ist bereits dein Name</span>}
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 8 }}>
            Crew-Name & Tag ändern: Crew-Modal → Einstellungen (nur Owner)
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="🌐 SPRACHE & EINHEITEN">
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <LanguageSwitcher />
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 8 }}>
            Weitere Sprachen folgen: Español, Français, Italiano, Nederlands, Português, Polski, Türkçe, 日本語, 中文, العربية …
          </div>
        </div>
        <SettingSelect
          label="📏 Einheiten"
          value={p?.setting_units || "metric"}
          options={UNITS.map(u => ({ id: u.id, label: u.label }))}
          onChange={(v) => updateSetting("setting_units", v)}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="🔔 BENACHRICHTIGUNGEN (PUSH)">
        <SettingRow label="Push aktivieren" checked={pushEnabled} onChange={async (v) => {
          if (v) {
            const { requestPushPermission } = await import("@/lib/prefs");
            const ok = await requestPushPermission();
            if (!ok) { appAlert(tMD("pushDeniedHint")); return; }
          }
          setPushEnabled(v);
        }} />
        <SettingRow label="💬 Crew-Chat" checked={notifCrewChat} onChange={setNotifCrewChat} />
        <SettingRow label="📅 Crew-Events & Treffen" checked={notifCrewEvents} onChange={setNotifCrewEvents} />
        <SettingRow label="⚔️ Rival-Duell gestartet" checked={notifDuels} onChange={setNotifDuels} />
        <SettingRow label="🏆 Achievement freigeschaltet" checked={notifAchievements} onChange={setNotifAchievements} />
        <SettingRow label="⭐ Neuer Rang erreicht" checked={notifRankUp} onChange={setNotifRankUp} />
        <SettingRow label="🏪 Shop-Deal in der Nähe" checked={notifShopDeals} onChange={setNotifShopDeals} />
        <SettingRow label="🔥 Streak läuft ab" checked={notifStreakWarn} onChange={setNotifStreakWarn} />
        <SettingRow label="🌙 Ruhe-Modus (Nacht)" checked={notifQuietMode} onChange={setNotifQuietMode} />
        <SettingSelect
          label="⏰ Ruhe ab"
          value={quietStart}
          options={Array.from({ length: 24 }, (_, i) => ({ id: String(i), label: `${i}:00` }))}
          onChange={setQuietStart}
        />
        <SettingSelect
          label="⏰ Ruhe bis"
          value={quietEnd}
          options={Array.from({ length: 24 }, (_, i) => ({ id: String(i), label: `${i}:00` }))}
          onChange={setQuietEnd}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="📧 E-MAIL-BENACHRICHTIGUNGEN">
        <SettingRow label="📊 Wöchentlicher Report" checked={emailWeekly} onChange={setEmailWeekly} />
        <SettingRow label="🏁 Monats-Statistik" checked={emailMonthly} onChange={setEmailMonthly} />
        <SettingRow label="📬 Kiez-Newsletter (monatlich)" checked={emailNewsletter} onChange={setEmailNewsletter} />
        <SettingRow label="⚡ Flash-Deals von Shops" checked={emailFlashDeals} onChange={setEmailFlashDeals} last />
      </SettingsGroup>

      <SettingsGroup title="🔒 PRIVATSPHÄRE">
        <SettingRow label="🌍 Öffentliches Profil" checked={p?.setting_privacy_public ?? true} onChange={(v) => updateSetting("setting_privacy_public", v)} />
        <SettingRow label="🏆 Auf Leaderboard erscheinen" checked={leaderboardVisible} onChange={setLeaderboardVisible} />
        <SettingRow label="📍 Live-Position in Crew teilen" checked={liveLocationCrew} onChange={setLiveLocationCrew} />
        <SettingRow label="🗺️ Gebiete öffentlich" checked={publicTerritories} onChange={setPublicTerritories} />
        <SettingRow label="🏃 Lauf-Routen öffentlich" checked={publicRoutes} onChange={setPublicRoutes} />
        <SettingRow label="🔎 Per Runner-Name findbar" checked={searchable} onChange={setSearchable} />
        <SettingRow label="👥 Crew-Einladungen zulassen" checked={allowCrewInvites} onChange={setAllowCrewInvites} />
        <SettingRow label="🤝 Freundschaftsanfragen" checked={allowFriends} onChange={setAllowFriends} last />
      </SettingsGroup>

      <SettingsGroup title="🏃 TRACKING & LAUF">
        <SettingRow label="⏸ Auto-Pause bei Stillstand" checked={p?.setting_auto_pause ?? true} onChange={(v) => updateSetting("setting_auto_pause", v)} />
        <SettingRow label="🔆 Bildschirm-Wachhalten (Wake-Lock)" checked={wakeLock} onChange={setWakeLock} />
        <SettingRow label="🧲 Snap-to-Roads" checked={snapToRoads} onChange={setSnapToRoads} />
        <SettingRow label="🎬 Auto-Start bei Bewegung" checked={autoStart} onChange={setAutoStart} />
        <SettingSelect
          label="📡 GPS-Genauigkeit"
          value={gpsAccuracy}
          options={[
            { id: "high", label: "Hoch (Akku ↓)" },
            { id: "balanced", label: "Ausgewogen" },
            { id: "low", label: "Spar-Modus" },
          ]}
          onChange={setGpsAccuracy}
        />
        <SettingRow label="🔊 Pace-Ansage (pro km)" checked={paceAnnounce} onChange={setPaceAnnounce} />
        <SettingSelect
          label="🗣️ Ansage-Stimme"
          value={paceVoice}
          options={[
            { id: "female", label: "Weiblich" },
            { id: "male", label: "Männlich" },
            { id: "neutral", label: "Neutral" },
          ]}
          onChange={setPaceVoice}
        />
        <SettingSelect
          label="⏱️ Ansage-Intervall"
          value={paceInterval}
          options={[
            { id: "0.5", label: "Alle 500 m" },
            { id: "1", label: "Jeden km" },
            { id: "2", label: "Alle 2 km" },
            { id: "5", label: "Alle 5 km" },
          ]}
          onChange={setPaceInterval}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="🎨 DARSTELLUNG">
        <SettingSelect
          label="🎭 Theme"
          value={theme}
          options={[
            { id: "dark", label: "Dunkel" },
            { id: "light", label: "Hell" },
            { id: "system", label: "System folgen" },
          ]}
          onChange={setTheme}
        />
        <SettingSelect
          label="🗺️ Map-Style"
          value={mapStyle}
          options={[
            { id: "standard", label: "Standard 3D" },
            { id: "satellite", label: "Satellit" },
            { id: "neon", label: "Neon Nacht" },
            { id: "minimal", label: "Minimal" },
          ]}
          onChange={setMapStyle}
        />
        <SettingSelect
          label="🎨 Akzent-Farbe"
          value={accentColor}
          options={[
            { id: "teal", label: "Teal (Standard)" },
            { id: "pink", label: "Pink" },
            { id: "gold", label: "Gold" },
            { id: "violet", label: "Violett" },
          ]}
          onChange={setAccentColor}
        />
        <SettingRow label="🏢 3D-Gebäude anzeigen" checked={buildings3d} onChange={setBuildings3d} />
        <SettingRow label="✨ Animationen" checked={animations} onChange={setAnimations} />
        <SettingRow label="♿ Bewegungen reduzieren" checked={reducedMotion} onChange={setReducedMotion} />
        <SettingSelect
          label="🔠 Schriftgröße"
          value={fontSize}
          options={[
            { id: "small", label: "Klein" },
            { id: "normal", label: "Normal" },
            { id: "large", label: "Groß" },
            { id: "xlarge", label: "Sehr groß" },
          ]}
          onChange={setFontSize}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="🔊 SOUND & HAPTIK">
        <SettingRow label="🔊 Sound-Effekte" checked={p?.setting_sound ?? true} onChange={(v) => updateSetting("setting_sound", v)} />
        <SettingRow label="🏆 Achievement-Sound" checked={achievementSound} onChange={setAchievementSound} />
        <SettingRow label="🎵 Musik während Lauf" checked={musicDuringRun} onChange={setMusicDuringRun} />
        <SettingRow label="📳 Haptik / Vibration" checked={haptics} onChange={setHaptics} last />
      </SettingsGroup>

      <SettingsGroup title="⚡ PERFORMANCE & AKKU">
        <SettingSelect
          label="📶 Daten-Modus"
          value={dataMode}
          options={[
            { id: "full", label: "Voll (Standard)" },
            { id: "saver", label: "Spar-Modus" },
            { id: "wifi", label: "Nur WLAN" },
          ]}
          onChange={setDataMode}
        />
        <SettingRow label="🗺️ Map-Tiles vorladen" checked={mapPreload} onChange={setMapPreload} />
        <SettingRow label="🔄 Hintergrund-Sync" checked={backgroundSync} onChange={setBackgroundSync} />
        <SettingRow label="📴 Offline-Modus" checked={offlineMode} onChange={setOfflineMode} last />
      </SettingsGroup>

      <SettingsGroup title="💰 WERBUNG & PARTNER">
        <SettingRow label="🎯 Personalisierte Shop-Vorschläge" checked={personalizedDeals} onChange={setPersonalizedDeals} />
        <SettingRow label="📊 Anonyme Nutzungsstatistik" checked={anonymousStats} onChange={setAnonymousStats} last />
      </SettingsGroup>

      <SettingsGroup title="🧪 BETA">
        <SettingRow label="🚀 Beta-Features aktivieren" checked={betaFeatures} onChange={setBetaFeatures} last />
      </SettingsGroup>

      <SettingsGroup title="🔐 ACCOUNT & DATEN">
        <SettingAction label="📧 E-Mail-Adresse ändern" onClick={async () => {
          const newEmail = prompt("Neue E-Mail-Adresse:");
          if (!newEmail) return;
          const { error } = await sb.auth.updateUser({ email: newEmail });
          if (error) appAlert("Fehler: " + error.message);
          else appAlert("Bestätigungs-Mail an beide Adressen gesendet.");
        }} />
        <SettingAction label="🔑 Passwort ändern" onClick={async () => {
          const newPw = prompt("Neues Passwort (min. 8 Zeichen):");
          if (!newPw || newPw.length < 8) { if (newPw) appAlert("Mindestens 8 Zeichen."); return; }
          const { error } = await sb.auth.updateUser({ password: newPw });
          if (error) appAlert("Fehler: " + error.message);
          else appAlert(tMD("passwordChanged"));
        }} />
        <SettingAction label="📥 Daten exportieren (DSGVO)" onClick={onExportData} />
        <SettingAction label="🛡️ Werbe-Einwilligung verwalten" onClick={async () => {
          const { openPrivacyOptions } = await import("@/components/ump-consent");
          openPrivacyOptions();
        }} />
        <SettingAction label="🚪 Ausloggen" onClick={onLogout} danger />
        <SettingAction label="⚠️ Konto löschen" onClick={async () => {
          if (!(await appConfirm({ title: tMD("deleteAccountTitle"), message: tMD("deleteAccountMessage"), danger: true, confirmLabel: tMD("deleteAccountConfirm") }))) return;
          appAlert("Account-Löschung per E-Mail an support@myarea365.de anfordern. (Automatisierter Flow folgt.)");
        }} danger last />
      </SettingsGroup>

      <SettingsGroup title="🧹 CACHE">
        <SettingAction label={tMD("cacheClearedLabel")} value={tMD("cacheSize")} onClick={() => {
          try { Object.keys(localStorage).filter(k => k.startsWith("cache:")).forEach(k => localStorage.removeItem(k)); } catch {}
          appAlert(tMD("cacheCleared"));
        }} last />
      </SettingsGroup>

      <div style={{ textAlign: "center", color: "#a8b4cf", fontSize: 11, padding: "8px 0 4px", lineHeight: 1.6 }}>
        MyArea365 · v0.9.0 (Beta) · <a href="/datenschutz" style={{ color: "#22D1C3" }}>Datenschutz</a> · <a href="/agb" style={{ color: "#22D1C3" }}>AGB</a> · <a href="mailto:support@myarea365.de" style={{ color: "#22D1C3" }}>Support</a>
      </div>
    </>
  );
}

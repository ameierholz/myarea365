"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { createClient } from "@/lib/supabase/client";
import { UNITS } from "@/lib/game-config";
import { useUnitLabel } from "@/lib/i18n-game";

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
  const t = useTranslations("AppSettings");
  const unitLabel = useUnitLabel();

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

  useEffect(() => {
    if (!nameDirty || !nameValid) {
      setAvail({ state: nameValid ? "idle" : "invalid" });
      return;
    }
    setAvail({ state: "checking" });
    const ctl = new AbortController();
    const tid = window.setTimeout(async () => {
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
    return () => { ctl.abort(); window.clearTimeout(tid); };
  }, [trimmedName, nameDirty, nameValid]);

  const saveDisplayName = async () => {
    if (!isFirstNameSet) {
      const ok = await appConfirm({
        title: t("renameDialogTitle"),
        message: t("renameDialogMsg", { cost: RENAME_COST }),
        danger: false,
        confirmLabel: t("renameDialogConfirm", { cost: RENAME_COST }),
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
      if (!j.ok) appAlert(j.message ?? j.error ?? t("renameError"));
      else {
        if (j.cost) {
          try { window.dispatchEvent(new CustomEvent("ma365:gems-changed")); } catch { /* ignore */ }
        }
        appAlert(j.cost ? t("renameSuccessCost", { cost: j.cost }) : t("renameSuccess"));
      }
    } catch { appAlert(t("renameNetworkError")); }
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

  const [emailWeekly, setEmailWeekly] = useLocalPref<boolean>("email_weekly", false);
  const [emailMonthly, setEmailMonthly] = useLocalPref<boolean>("email_monthly", true);
  const [emailNewsletter, setEmailNewsletter] = useLocalPref<boolean>("email_newsletter", false);
  const [emailFlashDeals, setEmailFlashDeals] = useLocalPref<boolean>("email_flash_deals", false);

  const [leaderboardVisible, setLeaderboardVisible] = useLocalPref<boolean>("privacy_leaderboard", true);
  const [liveLocationCrew, setLiveLocationCrew] = useLocalPref<boolean>("privacy_live_crew", true);
  const [publicTerritories, setPublicTerritories] = useLocalPref<boolean>("privacy_territories", true);
  const [publicRoutes, setPublicRoutes] = useLocalPref<boolean>("privacy_routes", false);
  const [searchable, setSearchable] = useLocalPref<boolean>("privacy_searchable", true);
  const [allowCrewInvites, setAllowCrewInvites] = useLocalPref<boolean>("privacy_crew_invites", true);
  const [allowFriends, setAllowFriends] = useLocalPref<boolean>("privacy_friends", true);

  const [gpsAccuracy, setGpsAccuracy] = useLocalPref<string>("track_gps", "high");
  const [snapToRoads, setSnapToRoads] = useLocalPref<boolean>("track_snap", true);
  const [wakeLock, setWakeLock] = useLocalPref<boolean>("track_wakelock", true);
  const [paceAnnounce, setPaceAnnounce] = useLocalPref<boolean>("track_pace_announce", false);
  const [paceVoice, setPaceVoice] = useLocalPref<string>("track_voice", "female");
  const [paceInterval, setPaceInterval] = useLocalPref<string>("track_pace_interval", "1");
  const [autoStart, setAutoStart] = useLocalPref<boolean>("track_autostart", false);

  const [theme, setTheme] = useLocalPref<string>("display_theme", "dark");
  const [mapStyle, setMapStyle] = useLocalPref<string>("display_mapstyle", "standard");
  const [buildings3d, setBuildings3d] = useLocalPref<boolean>("display_3d", true);
  const [reducedMotion, setReducedMotion] = useLocalPref<boolean>("display_reduced_motion", false);
  const [animations, setAnimations] = useLocalPref<boolean>("display_animations", true);
  const [fontSize, setFontSize] = useLocalPref<string>("display_font", "normal");
  const [accentColor, setAccentColor] = useLocalPref<string>("display_accent", "teal");

  const [musicDuringRun, setMusicDuringRun] = useLocalPref<boolean>("sound_music", false);
  const [haptics, setHaptics] = useLocalPref<boolean>("sound_haptics", true);
  const [achievementSound, setAchievementSound] = useLocalPref<boolean>("sound_achievement", true);

  const [dataMode, setDataMode] = useLocalPref<string>("perf_data", "full");
  const [mapPreload, setMapPreload] = useLocalPref<boolean>("perf_preload", true);
  const [backgroundSync, setBackgroundSync] = useLocalPref<boolean>("perf_bg_sync", true);
  const [offlineMode, setOfflineMode] = useLocalPref<boolean>("perf_offline", false);

  const [personalizedDeals, setPersonalizedDeals] = useLocalPref<boolean>("ads_personalized", true);
  const [anonymousStats, setAnonymousStats] = useLocalPref<boolean>("ads_anon_stats", true);

  const [betaFeatures, setBetaFeatures] = useLocalPref<boolean>("app_beta", false);

  const sb = createClient();

  return (
    <>
      <SettingsGroup title={t("groupProfile")} defaultOpen>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 6 }}>
            {t("renameLabel")}
            {!isFirstNameSet && (
              <span style={{ color: "#FFD700", fontWeight: 700, marginLeft: 6 }}>{t("renameCost", { cost: RENAME_COST })}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={displayName}
              maxLength={15}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("renamePlaceholder")}
              aria-label={t("renameAriaLabel")}
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
            >{renameBusy ? "…" : isFirstNameSet ? t("renameSave") : `${RENAME_COST}💎`}</button>
          </div>
          <div id="rename-status" aria-live="polite" style={{ minHeight: 18, marginTop: 6, fontSize: 11, fontWeight: 600 }}>
            {!nameDirty && <span style={{ color: "#a8b4cf" }}>&nbsp;</span>}
            {nameDirty && !nameValid && <span style={{ color: "#FF2D78" }}>{t("renameInvalid")}</span>}
            {nameDirty && nameValid && avail.state === "checking" && <span style={{ color: "#a8b4cf" }}>{t("renameChecking")}</span>}
            {nameDirty && avail.state === "free"  && <span style={{ color: "#22D1C3" }}>{t("renameFree")}</span>}
            {nameDirty && avail.state === "taken" && <span style={{ color: "#FF2D78" }}>{t("renameTaken")}</span>}
            {nameDirty && avail.state === "self"  && <span style={{ color: "#a8b4cf" }}>{t("renameSelf")}</span>}
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 8 }}>
            {t("renameCrewHint")}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("groupLanguage")}>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <LanguageSwitcher />
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 8 }}>
            {t("languagesMore")}
          </div>
        </div>
        <SettingSelect
          label={t("labelUnits")}
          value={p?.setting_units || "metric"}
          options={UNITS.map(u => ({ id: u.id, label: unitLabel(u.id) }))}
          onChange={(v) => updateSetting("setting_units", v)}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t("groupNotifPush")}>
        <SettingRow label={t("notifPushEnable")} checked={pushEnabled} onChange={async (v) => {
          if (v) {
            const { requestPushPermission } = await import("@/lib/prefs");
            const ok = await requestPushPermission();
            if (!ok) { appAlert(tMD("pushDeniedHint")); return; }
          }
          setPushEnabled(v);
        }} />
        <SettingRow label={t("notifCrewChat")} checked={notifCrewChat} onChange={setNotifCrewChat} />
        <SettingRow label={t("notifCrewEvents")} checked={notifCrewEvents} onChange={setNotifCrewEvents} />
        <SettingRow label={t("notifDuels")} checked={notifDuels} onChange={setNotifDuels} />
        <SettingRow label={t("notifAchievements")} checked={notifAchievements} onChange={setNotifAchievements} />
        <SettingRow label={t("notifRankUp")} checked={notifRankUp} onChange={setNotifRankUp} />
        <SettingRow label={t("notifShopDeals")} checked={notifShopDeals} onChange={setNotifShopDeals} />
        <SettingRow label={t("notifStreakWarn")} checked={notifStreakWarn} onChange={setNotifStreakWarn} />
        <SettingRow label={t("notifQuietMode")} checked={notifQuietMode} onChange={setNotifQuietMode} />
        <SettingSelect
          label={t("notifQuietFrom")}
          value={quietStart}
          options={Array.from({ length: 24 }, (_, i) => ({ id: String(i), label: `${i}:00` }))}
          onChange={setQuietStart}
        />
        <SettingSelect
          label={t("notifQuietTo")}
          value={quietEnd}
          options={Array.from({ length: 24 }, (_, i) => ({ id: String(i), label: `${i}:00` }))}
          onChange={setQuietEnd}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t("groupNotifEmail")}>
        <SettingRow label={t("emailWeekly")} checked={emailWeekly} onChange={setEmailWeekly} />
        <SettingRow label={t("emailMonthly")} checked={emailMonthly} onChange={setEmailMonthly} />
        <SettingRow label={t("emailNewsletter")} checked={emailNewsletter} onChange={setEmailNewsletter} />
        <SettingRow label={t("emailFlashDeals")} checked={emailFlashDeals} onChange={setEmailFlashDeals} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupPrivacy")}>
        <SettingRow label={t("privacyPublic")} checked={p?.setting_privacy_public ?? true} onChange={(v) => updateSetting("setting_privacy_public", v)} />
        <SettingRow label={t("privacyLeaderboard")} checked={leaderboardVisible} onChange={setLeaderboardVisible} />
        <SettingRow label={t("privacyLiveCrew")} checked={liveLocationCrew} onChange={setLiveLocationCrew} />
        <SettingRow label={t("privacyTerritories")} checked={publicTerritories} onChange={setPublicTerritories} />
        <SettingRow label={t("privacyRoutes")} checked={publicRoutes} onChange={setPublicRoutes} />
        <SettingRow label={t("privacySearchable")} checked={searchable} onChange={setSearchable} />
        <SettingRow label={t("privacyCrewInvites")} checked={allowCrewInvites} onChange={setAllowCrewInvites} />
        <SettingRow label={t("privacyFriends")} checked={allowFriends} onChange={setAllowFriends} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupTracking")}>
        <SettingRow label={t("trackAutoPause")} checked={p?.setting_auto_pause ?? true} onChange={(v) => updateSetting("setting_auto_pause", v)} />
        <SettingRow label={t("trackWakeLock")} checked={wakeLock} onChange={setWakeLock} />
        <SettingRow label={t("trackSnap")} checked={snapToRoads} onChange={setSnapToRoads} />
        <SettingRow label={t("trackAutoStart")} checked={autoStart} onChange={setAutoStart} />
        <SettingSelect
          label={t("trackGps")}
          value={gpsAccuracy}
          options={[
            { id: "high", label: t("trackGpsHigh") },
            { id: "balanced", label: t("trackGpsBalanced") },
            { id: "low", label: t("trackGpsLow") },
          ]}
          onChange={setGpsAccuracy}
        />
        <SettingRow label={t("trackPaceAnnounce")} checked={paceAnnounce} onChange={setPaceAnnounce} />
        <SettingSelect
          label={t("trackVoice")}
          value={paceVoice}
          options={[
            { id: "female", label: t("trackVoiceFemale") },
            { id: "male", label: t("trackVoiceMale") },
            { id: "neutral", label: t("trackVoiceNeutral") },
          ]}
          onChange={setPaceVoice}
        />
        <SettingSelect
          label={t("trackPaceInterval")}
          value={paceInterval}
          options={[
            { id: "0.5", label: t("paceEvery500") },
            { id: "1", label: t("paceEveryKm") },
            { id: "2", label: t("paceEvery2Km") },
            { id: "5", label: t("paceEvery5Km") },
          ]}
          onChange={setPaceInterval}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t("groupDisplay")}>
        <SettingSelect
          label={t("displayTheme")}
          value={theme}
          options={[
            { id: "dark", label: t("themeDark") },
            { id: "light", label: t("themeLight") },
            { id: "system", label: t("themeSystem") },
          ]}
          onChange={setTheme}
        />
        <SettingSelect
          label={t("displayMapStyle")}
          value={mapStyle}
          options={[
            { id: "standard", label: t("mapStandard") },
            { id: "satellite", label: t("mapSatellite") },
            { id: "neon", label: t("mapNeon") },
            { id: "minimal", label: t("mapMinimal") },
          ]}
          onChange={setMapStyle}
        />
        <SettingSelect
          label={t("displayAccent")}
          value={accentColor}
          options={[
            { id: "teal", label: t("accentTeal") },
            { id: "pink", label: t("accentPink") },
            { id: "gold", label: t("accentGold") },
            { id: "violet", label: t("accentViolet") },
          ]}
          onChange={setAccentColor}
        />
        <SettingRow label={t("display3d")} checked={buildings3d} onChange={setBuildings3d} />
        <SettingRow label={t("displayAnimations")} checked={animations} onChange={setAnimations} />
        <SettingRow label={t("displayReducedMotion")} checked={reducedMotion} onChange={setReducedMotion} />
        <SettingSelect
          label={t("displayFontSize")}
          value={fontSize}
          options={[
            { id: "small", label: t("fontSmall") },
            { id: "normal", label: t("fontNormal") },
            { id: "large", label: t("fontLarge") },
            { id: "xlarge", label: t("fontXLarge") },
          ]}
          onChange={setFontSize}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t("groupSound")}>
        <SettingRow label={t("soundEffects")} checked={p?.setting_sound ?? true} onChange={(v) => updateSetting("setting_sound", v)} />
        <SettingRow label={t("soundAchievement")} checked={achievementSound} onChange={setAchievementSound} />
        <SettingRow label={t("soundMusic")} checked={musicDuringRun} onChange={setMusicDuringRun} />
        <SettingRow label={t("soundHaptics")} checked={haptics} onChange={setHaptics} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupPerformance")}>
        <SettingSelect
          label={t("perfDataMode")}
          value={dataMode}
          options={[
            { id: "full", label: t("dataFull") },
            { id: "saver", label: t("dataSaver") },
            { id: "wifi", label: t("dataWifi") },
          ]}
          onChange={setDataMode}
        />
        <SettingRow label={t("perfPreload")} checked={mapPreload} onChange={setMapPreload} />
        <SettingRow label={t("perfBgSync")} checked={backgroundSync} onChange={setBackgroundSync} />
        <SettingRow label={t("perfOffline")} checked={offlineMode} onChange={setOfflineMode} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupAds")}>
        <SettingRow label={t("adsPersonalized")} checked={personalizedDeals} onChange={setPersonalizedDeals} />
        <SettingRow label={t("adsAnonymous")} checked={anonymousStats} onChange={setAnonymousStats} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupBeta")}>
        <SettingRow label={t("betaEnable")} checked={betaFeatures} onChange={setBetaFeatures} last />
      </SettingsGroup>

      <SettingsGroup title={t("groupAccount")}>
        <SettingAction label={t("accountChangeEmail")} onClick={async () => {
          const newEmail = prompt(t("accountEmailPrompt"));
          if (!newEmail) return;
          const { error } = await sb.auth.updateUser({ email: newEmail });
          if (error) appAlert(t("accountEmailError", { msg: error.message }));
          else appAlert(t("accountEmailSent"));
        }} />
        <SettingAction label={t("accountChangePw")} onClick={async () => {
          const newPw = prompt(t("accountPwPrompt"));
          if (!newPw || newPw.length < 8) { if (newPw) appAlert(t("accountPwTooShort")); return; }
          const { error } = await sb.auth.updateUser({ password: newPw });
          if (error) appAlert(t("accountEmailError", { msg: error.message }));
          else appAlert(tMD("passwordChanged"));
        }} />
        <SettingAction label={t("accountExport")} onClick={onExportData} />
        <SettingAction label={t("accountConsent")} onClick={async () => {
          const { openPrivacyOptions } = await import("@/components/ump-consent");
          openPrivacyOptions();
        }} />
        <SettingAction label={t("accountLogout")} onClick={onLogout} danger />
        <SettingAction label={t("accountDelete")} onClick={async () => {
          if (!(await appConfirm({ title: tMD("deleteAccountTitle"), message: tMD("deleteAccountMessage"), danger: true, confirmLabel: tMD("deleteAccountConfirm") }))) return;
          appAlert(t("accountDeleteHint"));
        }} danger last />
      </SettingsGroup>

      <SettingsGroup title={t("groupCache")}>
        <SettingAction label={tMD("cacheClearedLabel")} value={tMD("cacheSize")} onClick={() => {
          try { Object.keys(localStorage).filter(k => k.startsWith("cache:")).forEach(k => localStorage.removeItem(k)); } catch {}
          appAlert(tMD("cacheCleared"));
        }} last />
      </SettingsGroup>

      <div style={{ textAlign: "center", color: "#a8b4cf", fontSize: 11, padding: "8px 0 4px", lineHeight: 1.6 }}>
        {t("version")} · <a href="/datenschutz" style={{ color: "#22D1C3" }}>{t("privacyLink")}</a> · <a href="/agb" style={{ color: "#22D1C3" }}>{t("termsLink")}</a> · <a href="mailto:support@myarea365.de" style={{ color: "#22D1C3" }}>{t("supportLink")}</a>
      </div>
    </>
  );
}

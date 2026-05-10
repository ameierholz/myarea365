"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";

type Stats = Record<string, number | string | null>;
type Faction = "architect" | "warlord" | "strategist" | "diplomat" | "kronenwacht" | "gossenbund" | string;

// Spielstil-Definitionen — gespiegelt aus packages/supabase/migrations/00289_playstyle_buffs.sql
// Wenn ein Buff dort gepatcht wird, hier nachziehen!
type PlaystyleBuff = { label: string; mult: string; rpc: string; status: "live" | "stub" };
const PLAYSTYLE_META: Record<string, { name: string; emoji: string; color: string; tagline: string; buffs: PlaystyleBuff[] }> = {
  architect: {
    name: "Architekt", emoji: "🏗️", color: GOLD, tagline: "Wirtschaft · Aufbau",
    buffs: [
      { label: "Bau-Geschwindigkeit",   mult: "+5 %", rpc: "start_building",         status: "live" },
      { label: "Resourcen-Produktion",  mult: "+5 %", rpc: "_collect_one_building",  status: "live" },
    ],
  },
  warlord: {
    name: "Warlord", emoji: "⚔️", color: PINK, tagline: "Krieg · Eroberung",
    buffs: [
      { label: "Wächter-Schaden",       mult: "+5 %", rpc: "_reserve_user_troops",   status: "live" },
      { label: "Beute beim Plündern",   mult: "+5 %", rpc: "tick_gather_marches",    status: "live" },
    ],
  },
  strategist: {
    name: "Stratege", emoji: "🧠", color: PRIMARY, tagline: "Forschung · Spionage",
    buffs: [
      { label: "Forschungs-Geschwindigkeit", mult: "+5 %",  rpc: "start_research",     status: "live" },
      { label: "Tarn-Bonus bei Spionage",    mult: "0 Gold", rpc: "spy_player_base",   status: "live" },
    ],
  },
  diplomat: {
    name: "Diplomat", emoji: "🤝", color: "#a855f7", tagline: "Crew · Allianzen",
    buffs: [
      { label: "Crew-Beitrag",                  mult: "+10 %", rpc: "donate_to_crew_member", status: "live" },
      { label: "Stärkere Don-Aura",              mult: "+20 %", rpc: "get_user_active_buffs", status: "live" },
    ],
  },
};

type Section = {
  id: string;
  label: string;
  icon: string;
  color: string;
  rows: { stat: string; label: string; format?: "num" | "meters" | "days" | "bool" }[];
};

const SECTIONS: Section[] = [
  {
    id: "movement", label: "Bewegung", icon: "🚶", color: PRIMARY,
    rows: [
      { stat: "total_marches",       label: "Märsche gesamt" },
      { stat: "marches_completed",   label: "Erfolgreich beendet" },
      { stat: "total_meters_walked", label: "Strecke", format: "meters" },
      { stat: "night_owl_marches",   label: "Nacht-Märsche (0–5 Uhr)" },
    ],
  },
  {
    id: "combat", label: "Kampfstatistik", icon: "⚔️", color: PINK,
    rows: [
      { stat: "bandit_kills",   label: "Banditen besiegt" },
      { stat: "pvp_wins",       label: "Siege" },
      { stat: "pvp_losses",     label: "Niederlagen" },
      { stat: "units_killed",   label: "Getötete Einheiten" },
      { stat: "units_lost",     label: "Tote Einheiten" },
      { stat: "units_healed",   label: "Geheilte Einheiten" },
    ],
  },
  {
    id: "cvc", label: "CvC", icon: "🏆", color: GOLD,
    rows: [
      { stat: "cvc_participated",    label: "Teilnahmen" },
      { stat: "cvc_won",             label: "Saisons gewonnen" },
      { stat: "cvc_kills",           label: "CvC-Kills" },
      { stat: "cvc_mvp_count",       label: "MVP-Auszeichnungen" },
      { stat: "cvc_champion_count",  label: "Champion-Titel" },
      { stat: "vertrauen_peak",      label: "Höchstes Vertrauen" },
    ],
  },
  {
    id: "crew", label: "Crew & Trupp", icon: "🤝", color: PRIMARY,
    rows: [
      { stat: "crew_donations",         label: "Spenden" },
      { stat: "crew_chat_messages",     label: "Chat-Nachrichten" },
      { stat: "crew_member_days",       label: "Tage in Crew", format: "days" },
      { stat: "rallys_attended",        label: "Rallys teilgenommen" },
      { stat: "rallys_led",             label: "Rallys geleitet" },
      { stat: "walls_destroyed",        label: "Mauern eingerissen" },
      { stat: "wegelager_won",          label: "Wegelager gewonnen" },
      { stat: "crew_top1_eras",         label: "Crew Stadt-Platz 1 (Ären)" },
      { stat: "crew_top1_lifetime_days",label: "Crew Platz-1 Tage", format: "days" },
    ],
  },
  {
    id: "resources", label: "Ressourcen-Infos", icon: "💎", color: GOLD,
    rows: [
      { stat: "gold_total_collected",  label: "Krypto gesamt" },
      { stat: "gold_peak",             label: "Krypto-Spitzenwert" },
      { stat: "holz_total_collected",  label: "Tech-Schrott gesamt" },
      { stat: "stein_total_collected", label: "Komponenten gesamt" },
      { stat: "mana_total_collected",  label: "Bandbreite gesamt" },
    ],
  },
  {
    id: "build", label: "Bauen & Forschen", icon: "🔨", color: PRIMARY,
    rows: [
      { stat: "base_level",             label: "Base-Stufe" },
      { stat: "buildings_upgraded",     label: "Upgrades durchgeführt" },
      { stat: "building_max_level",     label: "Höchstes Gebäude (Stufe)" },
      { stat: "researches_completed",   label: "Forschungen" },
      { stat: "research_tree_complete", label: "Forschungsbaum komplett", format: "bool" },
    ],
  },
  {
    id: "guardian", label: "Wächter", icon: "🐾", color: PINK,
    rows: [
      { stat: "guardians_unlocked",      label: "Freigeschaltet" },
      { stat: "guardian_max_level",      label: "Höchste Stufe" },
      { stat: "awakenings_done",         label: "Awakenings" },
      { stat: "thief_classes_unlocked",  label: "Diebes-Klassen", format: "num" },
    ],
  },
  {
    id: "items", label: "Items & Crafting", icon: "🎒", color: GOLD,
    rows: [
      { stat: "items_crafted",         label: "Geschmiedet" },
      { stat: "items_legendary_owned", label: "Legendäre Items" },
      { stat: "items_mythic_owned",    label: "Mythische Items" },
      { stat: "item_sets_completed",   label: "Sets vervollständigt" },
    ],
  },
  {
    id: "exploration", label: "Erkundung", icon: "🗺️", color: PRIMARY,
    rows: [
      { stat: "districts_visited",   label: "Stadtteile besucht" },
      { stat: "streets_walked",      label: "Straßen abgegangen" },
      { stat: "screenshots_taken",   label: "Screenshots" },
    ],
  },
  {
    id: "social", label: "Sozial", icon: "🫂", color: PRIMARY,
    rows: [
      { stat: "friends_count",          label: "Freunde" },
      { stat: "dms_sent",               label: "DMs verschickt" },
      { stat: "emoji_reactions_used",   label: "Reaktionen" },
      { stat: "distinct_emojis_used",   label: "Verschiedene Emojis" },
      { stat: "invitations_sent",       label: "Einladungen" },
      { stat: "profile_views_other",    label: "Profile angesehen" },
    ],
  },
  {
    id: "loot", label: "Loot & Truhen", icon: "📦", color: GOLD,
    rows: [
      { stat: "chests_opened",            label: "Truhen geöffnet" },
      { stat: "chests_legendary_opened",  label: "Legendäre Truhen" },
      { stat: "chests_mythic_opened",     label: "Mythische Truhen" },
      { stat: "loot_drops_collected",     label: "Loot-Drops" },
      { stat: "gems_received",            label: "Edelsteine erhalten" },
      { stat: "gems_spent",               label: "Edelsteine ausgegeben" },
    ],
  },
  {
    id: "login", label: "Login & Aktivität", icon: "📅", color: PRIMARY,
    rows: [
      { stat: "login_streak_current",  label: "Aktuelle Streak", format: "days" },
      { stat: "login_streak_max",      label: "Beste Streak", format: "days" },
      { stat: "total_login_days",      label: "Login-Tage gesamt", format: "days" },
      { stat: "account_age_days",      label: "Account-Alter", format: "days" },
    ],
  },
  {
    id: "era", label: "Ära", icon: "⏳", color: GOLD,
    rows: [
      { stat: "eras_played",         label: "Ären gespielt" },
      { stat: "era_top10_count",     label: "Top-10 Platzierungen" },
      { stat: "era_top3_count",      label: "Top-3 Platzierungen" },
      { stat: "era_won_solo_count",  label: "Solo-Siege" },
      { stat: "era_score_max",       label: "Höchster Ära-Score" },
    ],
  },
  {
    id: "trophies", label: "Trophäen-Sammlung", icon: "🏅", color: GOLD,
    rows: [
      { stat: "achievements_unlocked", label: "Trophäen gesamt" },
      { stat: "achievements_bronze",   label: "Bronze" },
      { stat: "achievements_silver",   label: "Silber" },
      { stat: "achievements_gold",     label: "Gold" },
    ],
  },
];

function fmt(value: unknown, format?: string): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(n)) return "—";
  if (format === "meters") return n >= 1000 ? `${(n/1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km` : `${n.toLocaleString("de-DE")} m`;
  if (format === "days")   return `${n.toLocaleString("de-DE")} ${n === 1 ? "Tag" : "Tagen"}`;
  if (format === "bool")   return n > 0 ? "Ja" : "Nein";
  return n.toLocaleString("de-DE");
}

/**
 * Volle Statistik-Übersicht des Users — alle Lifetime-Counter aus user_stats.
 * Geöffnet via "Statistiken"-Tile im Profil-Dashboard.
 */
export function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [faction, setFaction] = useState<Faction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["playstyle", ...SECTIONS.slice(0, 4).map(s => s.id)]));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null); setStats(null); setFaction(null);
    void (async () => {
      try {
        const r = await fetch("/api/me/stats", { cache: "no-store" });
        const j = await r.json() as { stats?: Stats; faction?: Faction | null; error?: string };
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error ?? "Fehler beim Laden");
        setStats(j.stats ?? {});
        setFaction(j.faction ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const playstyle = faction && PLAYSTYLE_META[faction] ? PLAYSTYLE_META[faction] : null;

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg" zIndex={Z.modalDeep} reserveLeftSpace={372}>
      <ModalHeader title="📊 STATISTIK" onClose={onClose} accent="primary" />
      <ModalBody padding="tight">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.3)", color: "#FF6B4A", fontSize: 12 }}>
              ❌ {error}
            </div>
          )}
          {!stats && !error && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Statistik…</div>
          )}

          {/* Spielstil-Sektion (immer ganz oben, klappbar) */}
          {playstyle && (() => {
            const isOpen = openSections.has("playstyle");
            return (
              <div style={{
                borderRadius: 10,
                background: "rgba(15,17,21,0.6)",
                border: `1px solid ${playstyle.color}55`,
                overflow: "hidden", flexShrink: 0,
              }}>
                <button type="button" onClick={() => {
                  setOpenSections((cur) => {
                    const next = new Set(cur);
                    if (next.has("playstyle")) next.delete("playstyle"); else next.add("playstyle");
                    return next;
                  });
                }} style={{
                  width: "100%", minHeight: 38, padding: "0 12px",
                  background: `linear-gradient(135deg, ${playstyle.color}33, rgba(15,17,21,0.4))`,
                  border: "none", color: "#FFFFFF",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{playstyle.emoji}</span>
                    <span>Spielstil — {playstyle.name}</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 0.3 }}>
                      {playstyle.tagline}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, color: playstyle.color, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "8px 12px 10px", background: "rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: 6 }}>
                    {playstyle.buffs.map((b) => (
                      <div key={b.label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 10px", borderRadius: 8,
                        background: b.status === "live" ? `${playstyle.color}11` : "rgba(255,107,74,0.08)",
                        border: `1px solid ${b.status === "live" ? `${playstyle.color}33` : "rgba(255,107,74,0.3)"}`,
                        fontSize: 12, lineHeight: 1.3,
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: "#FFFFFF", fontWeight: 700 }}>
                            {b.status === "live" ? "✓" : "⏳"} {b.label}
                          </span>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "monospace" }}>
                            {b.status === "live" ? `aktiv in ${b.rpc}` : "noch nicht implementiert"}
                          </span>
                        </div>
                        <span style={{
                          color: b.status === "live" ? playstyle.color : "#FF6B4A",
                          fontWeight: 900, fontSize: 14, fontVariantNumeric: "tabular-nums",
                          textShadow: b.status === "live" ? `0 0 8px ${playstyle.color}66` : "none",
                        }}>{b.mult}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4, fontStyle: "italic" }}>
                      Spielstil wird beim Onboarding gewählt — DB-Spalte: <code>users.faction</code>, RPC: <code>playstyle_buff()</code>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {SECTIONS.map((sec) => {
            const isOpen = openSections.has(sec.id);
            const safeStats = stats ?? {};
            return (
              <div key={sec.id} style={{
                borderRadius: 10,
                background: "rgba(15,17,21,0.6)",
                border: `1px solid ${sec.color}55`,
                overflow: "hidden",
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenSections((cur) => {
                      const next = new Set(cur);
                      if (next.has(sec.id)) next.delete(sec.id); else next.add(sec.id);
                      return next;
                    });
                  }}
                  style={{
                    width: "100%", minHeight: 38, padding: "0 12px",
                    background: `linear-gradient(135deg, ${sec.color}33, rgba(15,17,21,0.4))`,
                    border: "none",
                    color: "#FFFFFF",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer", fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
                    fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#FFFFFF" }}>
                    <span style={{ fontSize: 16, display: "inline-block" }}>{sec.icon}</span>
                    <span style={{ color: "#FFFFFF" }}>{sec.label}</span>
                  </span>
                  <span style={{ fontSize: 14, color: sec.color, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "4px 12px 10px", display: "flex", flexDirection: "column", gap: 0, background: "rgba(0,0,0,0.25)" }}>
                    {sec.rows.map((row) => (
                      <div key={row.stat} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        fontSize: 12, lineHeight: 1.2,
                      }}>
                        <span style={{ color: "rgba(255,255,255,0.7)" }}>{row.label}</span>
                        <span style={{ color: "#FFFFFF", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(safeStats[row.stat], row.format)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ModalBody>
    </Modal>
  );
}

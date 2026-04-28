"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type Tab = "uebersicht" | "mitglieder" | "tech" | "kopfgelder" | "shop" | "einstellungen";

type Overview = {
  crew: { id: string; name: string; tag: string; color: string; zip: string; created_at: string };
  leader: { id: string; name: string; ansehen: number } | null;
  stats: { ansehen_total: number; member_count: number; repeater_count: number; territory_count: number };
  resources: { wood: number; stone: number; gold: number; mana: number } | null;
};
type TechDef = { id: string; name: string; description: string; category: "combat" | "economy" | "utility"; max_level: number; cost_gold_per_level: number; cost_wood_per_level: number; cost_stone_per_level: number; research_seconds_per_level: number; effect_per_level: number };
type TechProgress = { tech_id: string; level: number };
type TechQueue = { id: string; tech_id: string; target_level: number; ends_at: string };
type Bounty = { id: string; target_user_id: string; target_name: string; reward_gold: number; reason: string | null; posted_by_name: string; expires_at: string; created_at: string };
type ShopItem = { id: string; name: string; description: string; category: string; price_coins: number };

export function CrewModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uiArt = useUiIconArt();

  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data, error: e } = await sb.rpc("get_crew_overview", { p_crew_id: null });
      if (e) { setError(e.message); return; }
      const j = data as Overview | { error: string };
      if ("error" in j) { setError(j.error); return; }
      setOverview(j);
    })();
  }, []);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(960px, 100%)", maxHeight: "92vh", overflowY: "auto",
        background: BG, border: `1px solid ${PRIMARY}33`, borderRadius: 18,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${PRIMARY}22`,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ color: TEXT, fontSize: 20, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 1.2, display: "flex", alignItems: "center", gap: 8 }}>
            <UiIcon slot="quick_crew" fallback="⚔" art={uiArt} size={22} />
            CREW
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {error && (
          <div style={{ padding: 18, color: "#FF6B4A" }}>Fehler: {error}</div>
        )}
        {!error && !overview && (
          <div style={{ padding: 18, color: MUTED }}>Lade…</div>
        )}
        {!error && overview && (
          <>
            <Header overview={overview} />

            <Tabs tab={tab} onChange={setTab} uiArt={uiArt} />

            <div style={{ padding: 16 }}>
              {tab === "uebersicht"   && <TabUebersicht overview={overview} />}
              {tab === "mitglieder"   && <TabMitglieder crewId={overview.crew.id} />}
              {tab === "tech"         && <TabTech />}
              {tab === "kopfgelder"   && <TabKopfgelder crewId={overview.crew.id} />}
              {tab === "shop"         && <TabShop />}
              {tab === "einstellungen"&& <TabEinstellungen />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Header({ overview }: { overview: Overview }) {
  const { crew, leader, stats } = overview;
  const uiArt = useUiIconArt();
  return (
    <div style={{
      padding: "20px 18px",
      background: `linear-gradient(135deg, ${crew.color}22, transparent)`,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", gap: 16, alignItems: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `linear-gradient(135deg, ${crew.color}, ${crew.color}aa)`,
        color: BG, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, fontWeight: 900, boxShadow: `0 0 18px ${crew.color}88`,
      }}>{crew.tag.charAt(0)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: TEXT, fontSize: 28, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6, lineHeight: 1 }}>
          [{crew.tag}] {crew.name}
        </div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
          Anführer: <span style={{ color: TEXT, fontWeight: 700 }}>{leader?.name ?? "—"}</span> · PLZ {crew.zip}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#FFD700", fontSize: 26, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.4, lineHeight: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <UiIcon slot="stat_ansehen" fallback="⚜" art={uiArt} size={22} />
          {stats.ansehen_total.toLocaleString()}
        </div>
        <div style={{ color: MUTED, fontSize: 11 }}>Crew-Ansehen</div>
      </div>
    </div>
  );
}

function Tabs({ tab, onChange, uiArt }: { tab: Tab; onChange: (t: Tab) => void; uiArt: ReturnType<typeof useUiIconArt> }) {
  const tabs: Array<{ id: Tab; label: string; slot: string; fallback: string }> = [
    { id: "uebersicht",    label: "Übersicht",     slot: "crew_tab_overview", fallback: "📋" },
    { id: "mitglieder",    label: "Mitglieder",    slot: "crew_tab_members",  fallback: "👥" },
    { id: "tech",          label: "Forschung",     slot: "crew_tab_research", fallback: "🧪" },
    { id: "kopfgelder",    label: "Kopfgelder",    slot: "crew_tab_bounties", fallback: "🎯" },
    { id: "shop",          label: "Lagerhaus",     slot: "crew_tab_shop",     fallback: "📦" },
    { id: "einstellungen", label: "Einstellungen", slot: "crew_tab_settings", fallback: "⚙" },
  ];
  return (
    <div style={{
      display: "flex", overflowX: "auto", gap: 4, padding: "10px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "8px 14px", borderRadius: 10, whiteSpace: "nowrap",
            background: tab === t.id ? `${PRIMARY}22` : "transparent",
            border: tab === t.id ? `1px solid ${PRIMARY}` : "1px solid transparent",
            color: tab === t.id ? PRIMARY : MUTED,
            fontSize: 12, fontWeight: 800, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <UiIcon slot={t.slot} fallback={t.fallback} art={uiArt} size={16} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TabUebersicht({ overview }: { overview: Overview }) {
  const { stats, resources } = overview;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <StatCard label="Mitglieder" value={stats.member_count.toString()} />
        <StatCard label="Repeater"   value={stats.repeater_count.toString()} />
        <StatCard label="Straßen"    value={stats.territory_count.toString()} />
        <StatCard label="Ansehen"    value={stats.ansehen_total.toLocaleString()} accent="#FFD700" />
      </div>
      {resources && (
        <>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginTop: 18, marginBottom: 8 }}>
            CREW-LAGER (RSS)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <StatCard label="Holz"  value={resources.wood.toLocaleString()} />
            <StatCard label="Stein" value={resources.stone.toLocaleString()} />
            <StatCard label="Gold"  value={resources.gold.toLocaleString()} />
            <StatCard label="Mana"  value={resources.mana.toLocaleString()} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ color: accent ?? TEXT, fontSize: 18, fontWeight: 900 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TabMitglieder({ crewId }: { crewId: string }) {
  type Member = { id: string; display_name: string | null; username: string; ansehen: number };
  const [list, setList] = useState<Member[] | null>(null);
  const uiArt = useUiIconArt();
  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data: members } = await sb.from("crew_members").select("user_id").eq("crew_id", crewId);
      const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
      if (ids.length === 0) { setList([]); return; }
      const { data: users } = await sb.from("users").select("id, display_name, username, ansehen").in("id", ids);
      const sorted = (users as Member[] ?? []).sort((a, b) => (b.ansehen ?? 0) - (a.ansehen ?? 0));
      setList(sorted);
    })();
  }, [crewId]);
  if (!list) return <div style={{ color: MUTED }}>Lade Mitglieder…</div>;
  if (list.length === 0) return <div style={{ color: MUTED }}>Keine Mitglieder.</div>;
  return (
    <div>
      {list.map((m, i) => (
        <div key={m.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ color: MUTED, fontSize: 12, width: 24 }}>{i + 1}.</div>
          <div style={{ flex: 1, color: TEXT, fontSize: 13, fontWeight: 700 }}>
            {m.display_name || m.username}
          </div>
          <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <UiIcon slot="stat_ansehen" fallback="⚜" art={uiArt} size={14} />
            {(m.ansehen ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "fertig";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function TabTech() {
  const [defs, setDefs] = useState<TechDef[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<TechQueue[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_tech_state");
    if (!data) return;
    const j = data as { definitions: TechDef[]; progress: TechProgress[]; queue: TechQueue[] };
    setDefs(j.definitions);
    setProgress(Object.fromEntries(j.progress.map((p) => [p.tech_id, p.level])));
    setQueue(j.queue);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(techId: string) {
    setBusy(true); setMsg(null);
    const sb = createClient();
    const { data } = await sb.rpc("start_crew_tech", { p_tech_id: techId });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(`Fehler: ${r?.error ?? "unbekannt"}`);
    else setMsg("Forschung gestartet.");
    await load();
    setBusy(false);
  }

  const inQueue = queue[0];

  return (
    <div>
      {inQueue && (
        <div style={{
          padding: 12, borderRadius: 12, marginBottom: 12,
          background: `${PRIMARY}11`, border: `1px solid ${PRIMARY}55`,
          color: TEXT, fontSize: 13, fontWeight: 700,
        }}>
          🧪 In Forschung: <strong>{defs.find((d) => d.id === inQueue.tech_id)?.name}</strong> Stufe {inQueue.target_level} · noch {fmtCountdown(inQueue.ends_at)}
        </div>
      )}
      {msg && <div style={{ color: MUTED, fontSize: 12, marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        {defs.map((d) => {
          const lvl = progress[d.id] ?? 0;
          const next = lvl + 1;
          const maxed = lvl >= d.max_level;
          return (
            <div key={d.id} style={{
              padding: 12, borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ color: TEXT, fontSize: 14, fontWeight: 900 }}>{d.name}</span>
                <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 800 }}>Stufe {lvl}/{d.max_level}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>{d.description}</div>
              {!maxed && (
                <button
                  disabled={busy || !!inQueue}
                  onClick={() => start(d.id)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 10,
                    background: inQueue ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${PRIMARY}, #1ba89c)`,
                    border: "none", color: inQueue ? MUTED : BG, fontSize: 11, fontWeight: 900,
                    cursor: inQueue || busy ? "not-allowed" : "pointer",
                  }}
                >
                  Stufe {next} forschen · {(d.cost_gold_per_level * next).toLocaleString()} Gold
                </button>
              )}
              {maxed && <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 800 }}>✓ Maximal-Stufe</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabKopfgelder({ crewId }: { crewId: string }) {
  void crewId;
  const [list, setList] = useState<Bounty[] | null>(null);
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState(500);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_bounties");
    if (!data) return;
    setList((data as { bounties: Bounty[] }).bounties);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post() {
    setBusy(true); setMsg(null);
    const sb = createClient();
    // Lookup target by username
    const { data: u } = await sb.from("users").select("id").eq("username", target).maybeSingle();
    if (!u) { setMsg("Spieler nicht gefunden."); setBusy(false); return; }
    const { data } = await sb.rpc("post_crew_bounty", { p_target_user_id: (u as { id: string }).id, p_reward_gold: reward, p_reason: reason || null });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(`Fehler: ${r?.error ?? "unbekannt"}`);
    else { setMsg("Kopfgeld ausgesetzt."); setTarget(""); setReason(""); }
    await load();
    setBusy(false);
  }

  return (
    <div>
      <div style={{
        padding: 12, borderRadius: 12, marginBottom: 14,
        background: "rgba(255,107,74,0.08)", border: "1px solid rgba(255,107,74,0.35)",
      }}>
        <div style={{ color: TEXT, fontSize: 13, fontWeight: 900, marginBottom: 8 }}>🎯 Kopfgeld aussetzen</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Spieler-Username"
            style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <input type="number" value={reward} min={100} step={100} onChange={(e) => setReward(parseInt(e.target.value || "0"))}
            style={{ width: 110, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (optional)"
            style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <button onClick={post} disabled={busy || !target || reward < 100}
            style={{ padding: "8px 14px", borderRadius: 8, background: "linear-gradient(135deg, #FF6B4A, #FF2D78)", border: "none", color: "#FFF", fontSize: 12, fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
            Aussetzen
          </button>
        </div>
        {msg && <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>{msg}</div>}
      </div>

      {!list && <div style={{ color: MUTED }}>Lade Kopfgelder…</div>}
      {list && list.length === 0 && <div style={{ color: MUTED }}>Keine offenen Kopfgelder.</div>}
      {list && list.map((b) => (
        <div key={b.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>🎯 {b.target_name}</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
              von {b.posted_by_name}{b.reason ? ` · „${b.reason}"` : ""} · läuft {fmtCountdown(b.expires_at)}
            </div>
          </div>
          <div style={{ color: "#FFD700", fontSize: 14, fontWeight: 900 }}>{b.reward_gold.toLocaleString()} Gold</div>
        </div>
      ))}
    </div>
  );
}

function TabShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [crewGold, setCrewGold] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_shop");
    if (!data) return;
    const j = data as { items: ShopItem[]; crew_gold: number };
    setItems(j.items); setCrewGold(j.crew_gold);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function buy(id: string) {
    setBusy(id); setMsg(null);
    const sb = createClient();
    const { data } = await sb.rpc("buy_crew_shop_item", { p_item_id: id });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(`Fehler: ${r?.error ?? "unbekannt"}`);
    else setMsg("Gekauft.");
    await load();
    setBusy(null);
  }

  return (
    <div>
      <div style={{ color: TEXT, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
        💰 Crew-Lager: <span style={{ color: "#FFD700" }}>{crewGold.toLocaleString()} Gold</span>
      </div>
      {msg && <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {items.map((it) => {
          const ok = crewGold >= it.price_coins;
          return (
            <div key={it.id} style={{
              padding: 12, borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 900 }}>{it.name}</div>
              <div style={{ color: MUTED, fontSize: 11, margin: "4px 0 8px" }}>{it.description}</div>
              <button
                disabled={!ok || busy === it.id}
                onClick={() => buy(it.id)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 10,
                  background: ok ? "linear-gradient(135deg, #FFD700, #FFA500)" : "rgba(255,255,255,0.06)",
                  border: "none", color: ok ? BG : MUTED, fontSize: 11, fontWeight: 900,
                  cursor: ok ? "pointer" : "not-allowed",
                }}
              >Kaufen · {it.price_coins.toLocaleString()} Gold</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabEinstellungen() {
  const [hudOn, setHudOn] = useState<boolean | null>(null);
  const [territoryColor, setTerritoryColor] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState(false);
  const [colorMsg, setColorMsg] = useState<string | null>(null);
  const [canEditColor, setCanEditColor] = useState(false);

  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: u } = await sb.from("users").select("show_map_action_hud").eq("id", user.id).maybeSingle();
      setHudOn((u as { show_map_action_hud?: boolean } | null)?.show_map_action_hud ?? true);

      const { data: cm } = await sb.from("crew_members").select("crew_id, role").eq("user_id", user.id).maybeSingle();
      const cmRow = cm as { crew_id?: string; role?: string } | null;
      if (cmRow?.crew_id) {
        setCanEditColor(cmRow.role === "leader" || cmRow.role === "officer");
        const { data: c } = await sb.from("crews").select("territory_color").eq("id", cmRow.crew_id).maybeSingle();
        setTerritoryColor((c as { territory_color?: string | null } | null)?.territory_color ?? "#22D1C3");
      }
    })();
  }, []);

  async function toggle() {
    const next = !hudOn;
    setHudOn(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("users").update({ show_map_action_hud: next }).eq("id", user.id);
  }

  async function saveColor(color: string) {
    setSavingColor(true);
    setColorMsg(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("set_crew_territory_color", { p_color: color });
    setSavingColor(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      setColorMsg(error?.message || (data as { error?: string } | null)?.error || "Fehler");
      return;
    }
    setTerritoryColor(color);
    setColorMsg("✓ gespeichert");
    setTimeout(() => setColorMsg(null), 2000);
  }

  // 12 Preset-Farben — kräftig, gut auf dunkler Map sichtbar
  const COLOR_PRESETS = [
    "#22D1C3", "#FF2D78", "#FFD700", "#FF6B4A",
    "#A855F7", "#5DDAF0", "#4ADE80", "#F472B6",
    "#FB923C", "#818CF8", "#34D399", "#F87171",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Crew-Farbe (nur Leader/Officer) */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>CREW-FARBE</div>
        <div style={{ color: MUTED, fontSize: 11, marginBottom: 10, lineHeight: 1.4 }}>
          Bestimmt die Farbe eures Crew-Turfs auf der Karte (Repeater-Coverage, eigene Polygone, Pin-Akzente).
          {!canEditColor && <span style={{ color: "#FF6B4A", fontWeight: 800 }}> Nur Leader oder Officer dürfen ändern.</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {COLOR_PRESETS.map((c) => {
            const active = territoryColor === c;
            return (
              <button
                key={c}
                disabled={!canEditColor || savingColor}
                onClick={() => void saveColor(c)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  background: c,
                  border: active ? "3px solid #FFF" : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? `0 0 14px ${c}cc, inset 0 0 6px rgba(255,255,255,0.3)` : `0 2px 6px ${c}44`,
                  cursor: canEditColor && !savingColor ? "pointer" : "not-allowed",
                  opacity: canEditColor ? 1 : 0.5,
                  transition: "all 0.15s",
                }}
                title={c}
              />
            );
          })}
        </div>
        {colorMsg && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: colorMsg.startsWith("✓") ? "#4ade80" : "#FF6B4A" }}>
            {colorMsg}
          </div>
        )}
      </div>

      {/* Anzeige-Toggles */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>ANZEIGE</div>
        <button
          onClick={toggle}
          style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>⚔ Crew-Angriffe-Symbol auf der Karte</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
              Schwebender Knopf rechts unten zeigt offene Aufgebote zum Beitreten.
            </div>
          </div>
          <div style={{
            width: 48, height: 26, borderRadius: 13, position: "relative",
            background: hudOn ? PRIMARY : "rgba(255,255,255,0.15)",
            transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: 2, left: hudOn ? 24 : 2,
              width: 22, height: 22, borderRadius: 11, background: "#FFF",
              transition: "left 0.2s",
            }} />
          </div>
        </button>
      </div>
    </div>
  );
}

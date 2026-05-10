"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const ACCENT  = "#FF2D78";
const GOLD    = "#FFD700";
const ORANGE  = "#FF6B4A";

type CrewBuilding = {
  id: string;
  crew_id: string;
  crew_name: string | null;
  crew_tag: string | null;
  kind: "blackmarket" | "bunker" | "hangout" | "tunnel";
  level: number;
  label: string | null;
  lat: number;
  lng: number;
  hp: number;
  max_hp: number;
  is_own: boolean;
};

const KIND_INFO: Record<CrewBuilding["kind"], { label: string; emoji: string; accent: string; resource: string }> = {
  blackmarket: { label: "Schwarzmarkt",   emoji: "💰", accent: GOLD,    resource: "Krypto" },
  bunker:      { label: "Bunker",          emoji: "🛡", accent: PRIMARY, resource: "Verteidigung" },
  hangout:     { label: "Kiez-Treffpunkt", emoji: "🍻", accent: ORANGE,  resource: "Buffs" },
  tunnel:      { label: "Tunnel",          emoji: "🚇", accent: "#A855F7", resource: "Reach" },
};

/* ─────────────────────────────────────────────────────────────────────
   ROOT-Modal-Switch — wählt anhand Building-Kind die richtige Detail-View
   ───────────────────────────────────────────────────────────────────── */
export function CrewBuildingModal({ building, onClose, onChanged }: {
  building: CrewBuilding;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const info = KIND_INFO[building.kind];

  return (
    <ModalShell
      onClose={onClose}
      title={building.label || info.label}
      subtitle={`${info.label}${building.crew_tag ? ` · ${building.crew_tag}` : ""}`}
      emoji={info.emoji}
      accent={info.accent}
      hp={building.hp}
      maxHp={building.max_hp}
    >
      {!building.is_own && (
        <div style={{ padding: 16, color: "#8B8FA3", textAlign: "center", fontSize: 13 }}>
          Dieses Bauwerk gehört einer anderen Crew. Du siehst nur Basisinfos.
        </div>
      )}
      {building.is_own && building.kind === "blackmarket" && (
        <BlackmarketBody buildingId={building.id} onChanged={onChanged} />
      )}
      {building.is_own && building.kind === "bunker" && (
        <BunkerBody buildingId={building.id} onChanged={onChanged} />
      )}
      {building.is_own && building.kind === "hangout" && (
        <HangoutBody buildingId={building.id} onChanged={onChanged} />
      )}
      {building.is_own && building.kind === "tunnel" && (
        <TunnelBody buildingId={building.id} onChanged={onChanged} />
      )}
    </ModalShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCHWARZMARKT
   ───────────────────────────────────────────────────────────────────── */
type BlackmarketStatus = {
  ok: true;
  level: number; hp: number; max_hp: number;
  members: number;
  per_hour_per_member: number;
  per_hour_total: { gold: number; wood: number; stone: number; mana: number };
  last_tick_at: string | null;
  last_income: { gold: number; wood: number; stone: number; mana: number; hours: number; members: number } | null;
  treasury: { gold: number; wood: number; stone: number; mana: number };
  log_24h: Array<{ at: string; gold: number; wood: number; stone: number; mana: number }>;
};

function BlackmarketBody({ buildingId, onChanged }: { buildingId: string; onChanged?: () => void }) {
  const [status, setStatus] = useState<BlackmarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pct, setPct] = useState(100);
  const [role, setRole] = useState<string | null>(null);
  const resArt = useResourceArt();

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const [{ data: status }, { data: cm }] = await Promise.all([
      sb.rpc("get_blackmarket_status", { p_building_id: buildingId }),
      user ? sb.from("crew_members").select("role").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const s = status as { ok?: boolean } & BlackmarketStatus;
    if (!s?.ok) { setErr("Status nicht ladbar"); setStatus(null); }
    else { setStatus(s); }
    setRole((cm as { role?: string } | null)?.role ?? null);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Auch Cron-Tick on-demand triggern beim Öffnen — sofort sichtbarer Income
  useEffect(() => {
    (async () => {
      const sb = createClient();
      await sb.rpc("tick_blackmarket_income");
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOfficer = role === "leader" || role === "officer" || role === "admin";

  const withdrawAmounts = useMemo(() => {
    if (!status) return { gold: 0, wood: 0, stone: 0, mana: 0 };
    const f = pct / 100;
    return {
      gold: Math.floor(status.treasury.gold * f),
      wood: Math.floor(status.treasury.wood * f),
      stone: Math.floor(status.treasury.stone * f),
      mana: Math.floor(status.treasury.mana * f),
    };
  }, [status, pct]);

  async function withdraw() {
    if (!isOfficer) return;
    setWithdrawing(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("withdraw_crew_treasury", {
      p_gold: withdrawAmounts.gold,
      p_wood: withdrawAmounts.wood,
      p_stone: withdrawAmounts.stone,
      p_mana: withdrawAmounts.mana,
    });
    setWithdrawing(false);
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || !r?.ok) {
      setErr(r?.error || error?.message || "Abheben fehlgeschlagen");
      return;
    }
    onChanged?.();
    await refresh();
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3" }}>Lade Schwarzmarkt-Status…</div>;
  if (err && !status) return <div style={{ padding: 24, color: ACCENT, textAlign: "center" }}>{err}</div>;
  if (!status) return null;

  return (
    <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Treasury-Box */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: `radial-gradient(ellipse at top, ${GOLD}33 0%, transparent 70%), rgba(20,22,28,0.85)`,
        border: `1px solid ${GOLD}55`,
      }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
          Crew-Schatzkammer
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <ResRow label="Krypto"        value={status.treasury.gold}  art={resArt} kind="gold"  fb="🪙" />
          <ResRow label="Tech-Schrott"  value={status.treasury.wood}  art={resArt} kind="wood"  fb="🪵" />
          <ResRow label="Komponenten"   value={status.treasury.stone} art={resArt} kind="stone" fb="🪨" />
          <ResRow label="Bandbreite"    value={status.treasury.mana}  art={resArt} kind="mana"  fb="💧" />
        </div>
      </div>

      {/* Income-Vorschau */}
      <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>
            Income / Stunde
          </span>
          <span style={{ color: "#FFF", fontSize: 11, fontWeight: 700 }}>{status.members} Crew · Lv {status.level}</span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#FFF", flexWrap: "wrap" }}>
          <IncomeChip label="Krypto"       value={status.per_hour_total.gold}  color={GOLD} />
          <IncomeChip label="Tech-Schrott" value={status.per_hour_total.wood}  color="#8B6F2A" />
          <IncomeChip label="Komponenten"  value={status.per_hour_total.stone} color="#6E7681" />
          <IncomeChip label="Bandbreite"   value={status.per_hour_total.mana}  color={PRIMARY} />
        </div>
        {status.last_income && status.last_tick_at && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", color: "#8B8FA3", fontSize: 10 }}>
            Letzter Tick: {new Date(status.last_tick_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
            {" · +"}{status.last_income.gold + status.last_income.wood + status.last_income.stone + status.last_income.mana} Total
          </div>
        )}
      </div>

      {/* Withdraw-Slider */}
      {isOfficer ? (
        <div style={{ padding: 12, borderRadius: 10, background: `${GOLD}1a`, border: `1px solid ${GOLD}55` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: 0.4, textTransform: "uppercase" }}>
              Abheben
            </span>
            <span style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{pct}%</span>
          </div>
          <input
            type="range" min={5} max={100} step={5}
            value={pct} onChange={(e) => setPct(Number(e.target.value))}
            style={{ width: "100%", accentColor: GOLD }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: "#FFF" }}>
            ≈ {withdrawAmounts.gold}🪙  {withdrawAmounts.wood}🪵  {withdrawAmounts.stone}🪨  {withdrawAmounts.mana}💧
          </div>
          <button
            onClick={() => void withdraw()}
            disabled={withdrawing || (withdrawAmounts.gold + withdrawAmounts.wood + withdrawAmounts.stone + withdrawAmounts.mana) <= 0}
            style={{
              marginTop: 10, width: "100%", padding: "10px 14px", borderRadius: 10,
              background: `linear-gradient(135deg, ${GOLD}, #E6A700)`,
              border: "none", color: "#0F1115",
              fontWeight: 900, fontSize: 12, letterSpacing: 0.5,
              fontFamily: "var(--font-display-stack)",
              cursor: withdrawing ? "wait" : "pointer",
              opacity: withdrawing ? 0.7 : 1,
              boxShadow: `0 4px 12px ${GOLD}55`,
            }}
          >
            {withdrawing ? "ABHEBE..." : `${pct}% ABHEBEN`}
          </button>
          {err && <div style={{ marginTop: 6, color: ACCENT, fontSize: 11, textAlign: "center" }}>{err}</div>}
        </div>
      ) : (
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "#8B8FA3", fontSize: 11, textAlign: "center" }}>
          Nur Leader/Officer/Admin dürfen aus der Schatzkammer abheben.
        </div>
      )}

      {/* Log letzte 24h */}
      {status.log_24h.length > 0 && (
        <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", background: "rgba(255,255,255,0.04)" }}>
            Income letzte 24h ({status.log_24h.length} Ticks)
          </div>
          <div style={{ maxHeight: 120, overflowY: "auto" }}>
            {status.log_24h.slice(0, 12).map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 10, color: "#FFF", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ color: "#8B8FA3" }}>
                  {new Date(l.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>+{l.gold}🪙 {l.wood}🪵 {l.stone}🪨 {l.mana}💧</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: "4px 10px", borderRadius: 8,
      background: `${color}1a`, border: `1px solid ${color}44`,
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, fontWeight: 700, color: "#FFF",
    }}>
      <span style={{ color, fontWeight: 900 }}>{value}</span>
      <span style={{ color: "#8B8FA3", fontSize: 10 }}>{label}/h</span>
    </div>
  );
}

function ResRow({ label, value, art, kind, fb }: {
  label: string; value: number; art: ReturnType<typeof useResourceArt>;
  kind: "gold" | "wood" | "stone" | "mana"; fb: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(0,0,0,0.25)", borderRadius: 8 }}>
      <ResourceIcon kind={kind} size={20} fallback={fb} art={art} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.1 }}>
        <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>{value.toLocaleString("de-DE")}</span>
        <span style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   BUNKER
   ───────────────────────────────────────────────────────────────────── */
type BunkerStatus = {
  ok: true;
  level: number; hp: number; max_hp: number;
  total_defense: number;
  garrison: Array<{ user_id: string; username: string; troops: Record<string, number> }>;
  my_garrison: Record<string, number>;
  available_troops: Record<string, number>;
};
type TroopMeta = { id: string; name: string; emoji: string | null; troop_class: string | null; tier: number; base_def: number };

function BunkerBody({ buildingId, onChanged }: { buildingId: string; onChanged?: () => void }) {
  const [status, setStatus] = useState<BunkerStatus | null>(null);
  const [troops, setTroops] = useState<TroopMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deployForm, setDeployForm] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [{ data: status }, { data: catalog }] = await Promise.all([
      sb.rpc("get_bunker_status", { p_building_id: buildingId }),
      sb.from("troops_catalog").select("id, name, emoji, troop_class, tier, base_def").order("tier"),
    ]);
    const s = status as { ok?: boolean } & BunkerStatus;
    if (!s?.ok) { setErr("Status nicht ladbar"); }
    else setStatus(s);
    setTroops((catalog as TroopMeta[]) ?? []);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function deploy() {
    if (!status) return;
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(deployForm)) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) payload[k] = n;
    }
    if (Object.keys(payload).length === 0) return;
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("bunker_deploy_troops", { p_building_id: buildingId, p_troops: payload });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string; troop?: string; have?: number; need?: number } | null;
    if (error || !r?.ok) {
      setErr(r?.error === "insufficient_troops" ? `Nicht genug ${r.troop} (${r.have}/${r.need})` : r?.error || error?.message || "Deploy fehlgeschlagen");
      return;
    }
    setDeployForm({});
    onChanged?.();
    await refresh();
  }

  async function withdraw() {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("bunker_withdraw_troops", { p_building_id: buildingId });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || !r?.ok) {
      setErr(r?.error || error?.message || "Withdraw fehlgeschlagen");
      return;
    }
    onChanged?.();
    await refresh();
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3" }}>Lade Bunker-Status…</div>;
  if (err && !status) return <div style={{ padding: 24, color: ACCENT, textAlign: "center" }}>{err}</div>;
  if (!status) return null;

  const myDeployedCount = Object.values(status.my_garrison).reduce((a, b) => a + b, 0);
  const eligible = troops.filter((t) => t.troop_class !== "gatherer" && (status.available_troops[t.id] ?? 0) > 0);

  return (
    <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Defense-Box */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: `radial-gradient(ellipse at top, ${PRIMARY}33 0%, transparent 70%), rgba(20,22,28,0.85)`,
        border: `1px solid ${PRIMARY}55`,
        textAlign: "center",
      }}>
        <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Verteidigungswert
        </div>
        <div style={{ color: "#FFF", fontSize: 30, fontWeight: 900, fontFamily: "var(--font-display-stack)" }}>
          {status.total_defense.toLocaleString("de-DE")}
        </div>
        <div style={{ color: "#8B8FA3", fontSize: 10 }}>
          Counter-Schaden = 30% · capped 60% des Angreifer-ATK · Reichweite 600m
        </div>
      </div>

      {/* Mein Beitrag */}
      <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>Deine Truppen im Bunker</span>
          <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 800 }}>{myDeployedCount}</span>
        </div>
        {myDeployedCount === 0 ? (
          <div style={{ color: "#8B8FA3", fontSize: 11, padding: 6, textAlign: "center" }}>
            Du hast keine Truppen einquartiert.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(status.my_garrison).map(([troopId, count]) => {
              const t = troops.find((x) => x.id === troopId);
              return (
                <div key={troopId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#FFF" }}>
                  <span>{t?.emoji} {t?.name ?? troopId}</span>
                  <span style={{ color: PRIMARY, fontWeight: 800 }}>{count}</span>
                </div>
              );
            })}
            <button
              onClick={() => void withdraw()}
              disabled={busy}
              style={{
                marginTop: 6, padding: "8px 12px", borderRadius: 8,
                background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)",
                color: "#FF2D78", fontSize: 11, fontWeight: 800, cursor: "pointer",
              }}
            >
              Truppen abziehen
            </button>
          </div>
        )}
      </div>

      {/* Deploy-Formular */}
      {eligible.length > 0 && (
        <div style={{ padding: 12, borderRadius: 10, background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}33` }}>
          <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
            Truppen einquartieren
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {eligible.map((t) => {
              const avail = status.available_troops[t.id] ?? 0;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <span style={{ flex: 1, color: "#FFF" }}>{t.emoji} {t.name} <span style={{ color: "#8B8FA3" }}>(DEF {t.base_def})</span></span>
                  <span style={{ color: "#8B8FA3", fontSize: 10 }}>verf. {avail}</span>
                  <input
                    type="number" min={0} max={avail}
                    placeholder="0"
                    value={deployForm[t.id] ?? ""}
                    onChange={(e) => setDeployForm({ ...deployForm, [t.id]: e.target.value })}
                    style={{
                      width: 60, padding: "4px 6px", borderRadius: 6,
                      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#FFF", fontSize: 11, textAlign: "right",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <button
            onClick={() => void deploy()}
            disabled={busy}
            style={{
              marginTop: 10, width: "100%", padding: "10px 14px", borderRadius: 10,
              background: `linear-gradient(135deg, ${PRIMARY}, #1ba89c)`,
              border: "none", color: "#0F1115",
              fontWeight: 900, fontSize: 12, letterSpacing: 0.5,
              fontFamily: "var(--font-display-stack)",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
              boxShadow: `0 4px 12px ${PRIMARY}55`,
            }}
          >
            {busy ? "..." : "EINQUARTIEREN"}
          </button>
          {err && <div style={{ marginTop: 6, color: ACCENT, fontSize: 11, textAlign: "center" }}>{err}</div>}
        </div>
      )}

      {/* Crew-Beiträge */}
      {status.garrison.length > 0 && (
        <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>
            Crew-Beiträge
          </div>
          <div style={{ maxHeight: 140, overflowY: "auto" }}>
            {status.garrison.map((g) => {
              const total = Object.values(g.troops).reduce((a, b) => a + b, 0);
              return (
                <div key={g.user_id} style={{ padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#FFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{g.username}</span>
                    <span style={{ color: PRIMARY, fontWeight: 800 }}>{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   HANGOUT (Kiez-Treffpunkt)
   ───────────────────────────────────────────────────────────────────── */
type HangoutStatus = {
  ok: true;
  level: number; hp: number; max_hp: number;
  last_roll_at: string | null;
  cooldown_ends_at: string | null;
  can_roll: boolean;
  active_buff: { kind: string; magnitude: number; ends_at: string; rolled_by_user_id?: string } | null;
  buff_pool: string[];
  magnitude_at_level: number;
};

const BUFF_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  gather_yield: { label: "Plünder-Bonus",   icon: "💰", color: GOLD },
  march_speed:  { label: "Marsch-Speed",    icon: "🏃", color: PRIMARY },
  xp_gain:      { label: "XP-Bonus",        icon: "⭐", color: "#A855F7" },
  loot_chance:  { label: "Loot-Chance",     icon: "🎁", color: ORANGE },
};

function HangoutBody({ buildingId, onChanged }: { buildingId: string; onChanged?: () => void }) {
  const [status, setStatus] = useState<HangoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const { data } = await sb.rpc("get_hangout_status", { p_building_id: buildingId });
    const s = data as { ok?: boolean } & HangoutStatus;
    if (!s?.ok) setErr("Status nicht ladbar"); else setStatus(s);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function roll() {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("roll_hangout_buff", { p_building_id: buildingId });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string; remaining_seconds?: number } | null;
    if (error || !r?.ok) {
      setErr(r?.error === "on_cooldown" && r.remaining_seconds
        ? `Cooldown läuft noch ${Math.ceil(r.remaining_seconds / 60)} Min`
        : r?.error || error?.message || "Würfeln fehlgeschlagen");
      return;
    }
    onChanged?.();
    await refresh();
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3" }}>Lade Hangout-Status…</div>;
  if (err && !status) return <div style={{ padding: 24, color: ACCENT, textAlign: "center" }}>{err}</div>;
  if (!status) return null;

  const cdMs = status.cooldown_ends_at ? new Date(status.cooldown_ends_at).getTime() - now : 0;
  const cdMin = Math.max(0, Math.ceil(cdMs / 60000));
  const buffActive = status.active_buff;
  const buffMs = buffActive ? new Date(buffActive.ends_at).getTime() - now : 0;
  const buffMin = Math.max(0, Math.ceil(buffMs / 60000));
  const buffMeta = buffActive ? BUFF_LABELS[buffActive.kind] : null;

  return (
    <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Active Buff Box */}
      {buffActive && buffMeta ? (
        <div style={{
          padding: 14, borderRadius: 12,
          background: `radial-gradient(ellipse at top, ${buffMeta.color}33 0%, transparent 70%), rgba(20,22,28,0.85)`,
          border: `1px solid ${buffMeta.color}55`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4 }}>{buffMeta.icon}</div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display-stack)" }}>
            {buffMeta.label} aktiv
          </div>
          <div style={{ color: buffMeta.color, fontSize: 22, fontWeight: 900 }}>
            +{Math.round(buffActive.magnitude * 100)}%
          </div>
          <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
            für die ganze Crew · noch {buffMin} Min
          </div>
        </div>
      ) : (
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", textAlign: "center", color: "#8B8FA3" }}>
          Kein aktiver Buff. Würfle einen neuen.
        </div>
      )}

      {/* Buff-Pool Vorschau */}
      <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
          Möglicher Roll (gleichverteilt)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {status.buff_pool.map((b) => {
            const meta = BUFF_LABELS[b];
            return (
              <div key={b} style={{
                padding: "6px 10px", borderRadius: 8,
                background: `${meta.color}1a`, border: `1px solid ${meta.color}33`,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, color: "#FFF",
              }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 11 }}>{meta.label}</div>
                  <div style={{ color: meta.color, fontWeight: 900, fontSize: 10 }}>+{Math.round(status.magnitude_at_level * 100)}%</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, color: "#8B8FA3", fontSize: 10 }}>
          Lv {status.level} · Buff dauert 1h · Cooldown 6h pro Roll
        </div>
      </div>

      {/* Roll-Button oder Cooldown */}
      {status.can_roll ? (
        <button
          onClick={() => void roll()}
          disabled={busy}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: `linear-gradient(135deg, ${ORANGE}, #D14E2E)`,
            border: "none", color: "#FFF",
            fontSize: 13, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase",
            fontFamily: "var(--font-display-stack)",
            cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
            boxShadow: `0 4px 12px ${ORANGE}55`,
          }}
        >
          {busy ? "..." : "🎲 Buff würfeln"}
        </button>
      ) : (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}>
          <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 700 }}>Cooldown</div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>{cdMin} Min</div>
        </div>
      )}
      {err && <div style={{ color: ACCENT, fontSize: 11, textAlign: "center" }}>{err}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   TUNNEL
   ───────────────────────────────────────────────────────────────────── */
type TunnelStatus = {
  ok: true;
  level: number; hp: number; max_hp: number;
  is_paired: boolean;
  partner: { id: string; label: string | null; lat: number; lng: number; distance_m: number } | null;
  pairable_tunnels: Array<{ id: string; label: string | null; lat: number; lng: number; distance_m: number }>;
};

function TunnelBody({ buildingId, onChanged }: { buildingId: string; onChanged?: () => void }) {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const { data } = await sb.rpc("get_tunnel_status", { p_building_id: buildingId });
    const s = data as { ok?: boolean } & TunnelStatus;
    if (!s?.ok) setErr("Status nicht ladbar"); else setStatus(s);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function pairWith(partnerId: string) {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("pair_tunnels", { p_tunnel_a: buildingId, p_tunnel_b: partnerId });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string; hint?: string } | null;
    if (error || !r?.ok) {
      setErr(r?.hint || r?.error || error?.message || "Pairing fehlgeschlagen");
      return;
    }
    onChanged?.();
    await refresh();
  }

  async function unpair() {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("unpair_tunnel", { p_tunnel_id: buildingId });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || !r?.ok) {
      setErr(r?.error || error?.message || "Trennen fehlgeschlagen");
      return;
    }
    onChanged?.();
    await refresh();
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3" }}>Lade Tunnel-Status…</div>;
  if (err && !status) return <div style={{ padding: 24, color: ACCENT, textAlign: "center" }}>{err}</div>;
  if (!status) return null;

  const TUNNEL_COLOR = "#A855F7";

  return (
    <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      {status.is_paired && status.partner ? (
        <div style={{
          padding: 14, borderRadius: 12,
          background: `radial-gradient(ellipse at top, ${TUNNEL_COLOR}33 0%, transparent 70%), rgba(20,22,28,0.85)`,
          border: `1px solid ${TUNNEL_COLOR}55`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4 }}>🚇</div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 800 }}>Tunnel aktiv</div>
          <div style={{ color: TUNNEL_COLOR, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
            verbunden mit <b>{status.partner.label || "Tunnel"}</b>
          </div>
          <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>
            Distanz: {(status.partner.distance_m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km
          </div>
          <div style={{ color: "#FFF", fontSize: 10, marginTop: 8, padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
            Repeater können in 200m dieser Tunnel platziert werden, als wären sie beim gepaarten Endpunkt — Chain-Hop überbrückt die Distanz.
          </div>
          <button
            onClick={() => void unpair()}
            disabled={busy}
            style={{
              marginTop: 10, padding: "8px 14px", borderRadius: 8,
              background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)",
              color: ACCENT, fontSize: 11, fontWeight: 800, cursor: "pointer",
            }}
          >
            Verbindung trennen
          </button>
        </div>
      ) : (
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
          <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4, opacity: 0.6 }}>🚇</div>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800 }}>Nicht gekoppelt</div>
          <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 4 }}>
            Wähle einen anderen Tunnel der Crew als Endpunkt aus.
          </div>
        </div>
      )}

      {!status.is_paired && status.pairable_tunnels.length > 0 && (
        <div style={{ padding: 12, borderRadius: 10, background: `${TUNNEL_COLOR}10`, border: `1px solid ${TUNNEL_COLOR}33` }}>
          <div style={{ color: TUNNEL_COLOR, fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
            Verfügbare Endpunkte
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {status.pairable_tunnels.map((t) => (
              <button
                key={t.id}
                onClick={() => void pairWith(t.id)}
                disabled={busy}
                style={{
                  padding: "10px 12px", borderRadius: 8, textAlign: "left",
                  background: "rgba(20,22,28,0.7)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#FFF", cursor: busy ? "wait" : "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{t.label || "Tunnel"}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 10 }}>
                    {(t.distance_m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km entfernt
                  </div>
                </div>
                <span style={{ color: TUNNEL_COLOR, fontSize: 11, fontWeight: 900 }}>→ Pair</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!status.is_paired && status.pairable_tunnels.length === 0 && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#8B8FA3", fontSize: 11, textAlign: "center" }}>
          Keine ungepaarten Tunnel verfügbar. Erbaue einen weiteren Tunnel um diesen zu koppeln.
        </div>
      )}
      {err && <div style={{ color: ACCENT, fontSize: 11, textAlign: "center" }}>{err}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Modal-Shell + Helper
   ───────────────────────────────────────────────────────────────────── */
function ModalShell({ children, onClose, title, subtitle, emoji, accent, hp, maxHp }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string; subtitle: string;
  emoji: string; accent: string;
  hp: number; maxHp: number;
}) {
  const hpPct = Math.max(0, Math.min(100, (hp / Math.max(maxHp, 1)) * 100));
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9300,
        background: "rgba(8,10,14,0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "rgba(15,17,21,0.96)",
          borderRadius: 14,
          border: `1px solid ${accent}55`,
          boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 32px ${accent}33`,
          overflow: "hidden",
          maxHeight: "100dvh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          position: "relative", flexShrink: 0,
          padding: "8px 10px 6px",
          background: `
            radial-gradient(ellipse at 30% 20%, ${accent}55 0%, transparent 55%),
            radial-gradient(ellipse at 75% 75%, ${accent}33 0%, transparent 50%),
            linear-gradient(180deg, rgba(20,22,28,0.85) 0%, rgba(15,17,21,0.95) 100%)
          `,
          textAlign: "center",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 6, right: 6,
              width: 22, height: 22, borderRadius: 11,
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#FFF", fontSize: 12, cursor: "pointer", lineHeight: 1,
            }}
          >×</button>
          <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 2, filter: `drop-shadow(0 0 12px ${accent}88)` }}>{emoji}</div>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.4 }}>
            {title}
          </div>
          <div style={{ color: accent, fontSize: 8, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", marginTop: 1 }}>
            {subtitle}
          </div>
          <div style={{ marginTop: 5, padding: "0 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 700 }}>Haltbarkeit</span>
              <span style={{ color: "#FFF", fontSize: 8, fontWeight: 800 }}>{hp.toLocaleString("de-DE")} / {maxHp.toLocaleString("de-DE")}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                width: `${hpPct}%`, height: "100%",
                background: hpPct > 50 ? "#22D1C3" : hpPct > 20 ? "#FFD700" : "#FF2D78",
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SimplePlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "20px 18px", textAlign: "center" }}>
      <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#8B8FA3", fontSize: 12, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

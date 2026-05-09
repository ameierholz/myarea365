"use client";

/**
 * CREW-MEMBER-MODAL — wenn ein Crew-Mate-Base-Pin getippt wird.
 * Layout: Avatar + [TAG]Name + Stats (Ansehen/Verdienste/Crew) + 2 Buttons.
 *  - UNTERSTÜTZEN  → DonateResourcesSubModal (4 Slider, daily-cap 5000/Resource)
 *  - VERSTÄRKEN    → ReinforceSubModal (Truppen+Wächter, send_base_reinforcement)
 */

import { useEffect, useMemo, useState } from "react";
import { Star, Share2, Info } from "lucide-react";

type Stats = {
  ok: boolean;
  user: {
    id: string; username: string | null; display_name: string | null;
    level: number; avatar_url: string | null;
    ansehen: number; verdienste: number;
    bandits_killed: number; members_killed: number;
  };
  crew: { id: string; name: string; tag: string; color: string };
  active_reinforcements: number;
};

export function CrewMemberModal({ userId, anchorX, anchorY, onClose }: {
  userId: string; anchorX: number; anchorY: number; onClose: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSub, setOpenSub] = useState<null | "donate" | "reinforce">(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/heimat/crew-member-stats?user_id=${userId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Stats) => setStats(j.ok ? j : null))
      .finally(() => setLoading(false));
  }, [userId]);

  const cardW = 300;
  const cardH = 360;
  const left = Math.min(window.innerWidth - cardW - 8, Math.max(8, anchorX - cardW / 2));
  const top = Math.min(window.innerHeight - cardH - 8, Math.max(60, anchorY - cardH - 16));

  if (loading || !stats?.ok) {
    return (
      <>
        <div className="fixed inset-0 z-[9090]" onClick={onClose} />
        <div className="fixed z-[9100] bg-[#1A1D23] border border-[#22D1C3]/30 rounded-2xl p-4 text-[#F0F0F0] text-sm"
          style={{ left, top, width: cardW }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? "Lade…" : "Spieler nicht gefunden oder nicht in deiner Crew."}
        </div>
      </>
    );
  }

  const u = stats.user;
  const c = stats.crew;
  const fullName = `[${c.tag}] ${u.display_name ?? u.username ?? "Unbekannt"}`;

  return (
    <>
      <div className="fixed inset-0 z-[9090]" onClick={onClose} />
      <div
        className="fixed z-[9100] bg-gradient-to-b from-[#1A1D23] to-[#0F1115] border border-[#22D1C3]/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{ left, top, width: cardW }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero: Avatar + dekorativer Gradient */}
        <div className="relative h-[110px] bg-gradient-to-br from-[#22D1C3]/30 via-[#FF2D78]/20 to-[#0F1115] flex items-center justify-center">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, #22D1C3 0%, transparent 50%), radial-gradient(circle at 80% 70%, #FF2D78 0%, transparent 50%)",
          }} />
          <div className="relative">
            <div
              className="w-[68px] h-[68px] rounded-full border-2 bg-[#0F1115] flex items-center justify-center text-2xl shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
              style={{ borderColor: c.color || "#22D1C3" }}
            >
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : <span className="text-white">{(u.display_name ?? u.username ?? "?")[0]?.toUpperCase()}</span>}
            </div>
            <div
              className="absolute -bottom-1 right-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-[#0F1115]"
              style={{ borderColor: c.color || "#22D1C3", color: c.color || "#22D1C3" }}
            >
              {u.level}
            </div>
          </div>
          {/* Side-Icons */}
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            <button className="w-[26px] h-[26px] rounded-full bg-white/10 backdrop-blur-md border border-[#22D1C3]/50 text-[#22D1C3] flex items-center justify-center hover:bg-[#22D1C3]/20 hover:scale-110 transition-all" title="Profil">
              <Info size={13} strokeWidth={2.5} />
            </button>
            <button className="w-[26px] h-[26px] rounded-full bg-white/10 backdrop-blur-md border border-[#FFD700]/50 text-[#FFD700] flex items-center justify-center hover:bg-[#FFD700]/20 hover:scale-110 transition-all" title="Markieren">
              <Star size={13} strokeWidth={2.5} fill="currentColor" />
            </button>
            <button className="w-[26px] h-[26px] rounded-full bg-white/10 backdrop-blur-md border border-[#22D1C3]/50 text-[#22D1C3] flex items-center justify-center hover:bg-[#22D1C3]/20 hover:scale-110 transition-all" title="Teilen">
              <Share2 size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-3">
          <div className="text-base font-bold text-[#F0F0F0] truncate" title={fullName}>{fullName}</div>
          <div className="space-y-1 mt-2 mb-3">
            <StatRow label="Ansehen" value={u.ansehen.toLocaleString("de-DE")} />
            <StatRow label="Verdienste" value={u.verdienste.toLocaleString("de-DE")} hint="Banditen + getötete Gegner" />
            <StatRow label="Crew" value={`[${c.tag}]`} accent={c.color} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOpenSub("donate")}
              className="bg-gradient-to-b from-[#22D1C3] to-[#1AA89D] text-[#0F1115] font-bold py-2.5 rounded-lg text-[13px] shadow-md hover:from-[#26E5D6] active:scale-95 transition"
            >
              UNTERSTÜTZEN
            </button>
            <button
              onClick={() => setOpenSub("reinforce")}
              className="bg-gradient-to-b from-[#FF2D78] to-[#C4135B] text-white font-bold py-2.5 rounded-lg text-[13px] shadow-md hover:from-[#FF4A8E] active:scale-95 transition"
            >
              VERSTÄRKEN
            </button>
          </div>

          {stats.active_reinforcements > 0 && (
            <div className="text-[11px] text-[#22D1C3] mt-2 text-center">
              🛡 Aktiv: {stats.active_reinforcements} Verstärkung{stats.active_reinforcements > 1 ? "en" : ""}
            </div>
          )}
        </div>
      </div>

      {openSub === "donate" && (
        <DonateResourcesSubModal
          recipient={{ id: u.id, name: fullName, avatar: u.avatar_url, color: c.color }}
          onClose={() => setOpenSub(null)}
          onSuccess={() => { setOpenSub(null); onClose(); }}
        />
      )}
      {openSub === "reinforce" && (
        <ReinforceSubModal
          recipient={{ id: u.id, name: fullName, avatar: u.avatar_url, color: c.color }}
          onClose={() => setOpenSub(null)}
          onSuccess={() => { setOpenSub(null); onClose(); }}
        />
      )}
    </>
  );
}

function StatRow({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-[#8B8FA3]" title={hint}>{label}</span>
      <span className="font-bold truncate" style={{ color: accent ?? "#F0F0F0" }}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUB-MODAL: UNTERSTÜTZEN (Resources)
// ════════════════════════════════════════════════════════════════════

type Recipient = { id: string; name: string; avatar: string | null; color: string };

function DonateResourcesSubModal({ recipient, onClose, onSuccess }: {
  recipient: Recipient; onClose: () => void; onSuccess: () => void;
}) {
  const [have, setHave] = useState({ wood: 0, stone: 0, gold: 0, mana: 0 });
  const [amounts, setAmounts] = useState({ wood: 0, stone: 0, gold: 0, mana: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/base/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((j: { resources?: { wood?: number; stone?: number; gold?: number; mana?: number } } | null) => {
        const r = j?.resources;
        if (r) setHave({ wood: r.wood ?? 0, stone: r.stone ?? 0, gold: r.gold ?? 0, mana: r.mana ?? 0 });
      })
      .catch(() => {});
  }, []);

  const totalUnits = amounts.wood + amounts.stone + amounts.gold + amounts.mana;
  const transportCap = 5_000_000;

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/heimat/donate-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: recipient.id, amounts }),
      });
      const j = await r.json() as { ok?: boolean; results?: Record<string, { sent: number; error: string | null }> };
      if (j.ok && j.results) {
        const totalSent = Object.values(j.results).reduce((a, b) => a + b.sent, 0);
        const errs = Object.entries(j.results).filter(([, v]) => v.error).map(([k, v]) => `${k}: ${v.error}`);
        setMsg(errs.length ? `⚠️ ${totalSent} gesendet, Fehler: ${errs.join(", ")}` : `✅ ${totalSent} versendet`);
        setTimeout(onSuccess, 1500);
      } else setMsg("❌ Transport fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#22D1C3]/40 rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-[#F0F0F0] uppercase tracking-wider">Ressourcen-Unterstützung</div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <div className="flex items-center gap-3 mb-4 p-2 bg-white/5 rounded-lg">
          <div className="w-12 h-12 rounded-full border-2 bg-[#0F1115] flex items-center justify-center" style={{ borderColor: recipient.color }}>
            {recipient.avatar
              ? <img src={recipient.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              : <span className="text-white text-base font-bold">{recipient.name[1]?.toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#F0F0F0] truncate">{recipient.name}</div>
            <div className="text-[10px] text-[#8B8FA3]">Steuer: 0% · Cap: {transportCap.toLocaleString("de-DE")}</div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {([
            { k: "gold" as const,  emoji: "🪙", color: "#FFD700", label: "Krypto" },
            { k: "wood" as const,  emoji: "🪵", color: "#A86B3C", label: "Tech-Schrott" },
            { k: "stone" as const, emoji: "🪨", color: "#8B8FA3", label: "Komponenten" },
            { k: "mana" as const,  emoji: "💧", color: "#22D1C3", label: "Bandbreite" },
          ]).map((r) => {
            const max = Math.min(have[r.k], 5000);
            return (
              <div key={r.k}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#F0F0F0]">{r.emoji} {r.label}</span>
                  <span className="text-[#8B8FA3]">Vorrat: {have[r.k].toLocaleString("de-DE")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0} max={max} step={50}
                    value={amounts[r.k]}
                    onChange={(e) => setAmounts({ ...amounts, [r.k]: parseInt(e.target.value, 10) })}
                    className="flex-1 accent-[#22D1C3]"
                    style={{ accentColor: r.color }}
                  />
                  <input
                    type="number" min={0} max={max}
                    value={amounts[r.k]}
                    onChange={(e) => setAmounts({ ...amounts, [r.k]: Math.max(0, Math.min(max, parseInt(e.target.value || "0", 10))) })}
                    className="w-20 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0]"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#8B8FA3] mb-2">
          <span>Transport: {totalUnits.toLocaleString("de-DE")} / {transportCap.toLocaleString("de-DE")}</span>
        </div>
        {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy || totalUnits < 1}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#22D1C3] to-[#1AA89D] text-[#0F1115] font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "TRANSPORT"}
        </button>
        <div className="text-[10px] text-[#8B8FA3] mt-2 text-center">Empfangs-Limit pro Tag: 5.000 / Resource</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUB-MODAL: VERSTÄRKEN (Truppen)
// ════════════════════════════════════════════════════════════════════

function ReinforceSubModal({ recipient, onClose, onSuccess }: {
  recipient: Recipient; onClose: () => void; onSuccess: () => void;
}) {
  const [troops, setTroops] = useState<Record<string, number>>({});
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [available, setAvailable] = useState<Array<{ id: string; name: string; tier: number; have: number }>>([]);
  const [guardians, setGuardians] = useState<Array<{ id: string; name: string; level: number }>>([]);
  const [marchCap, setMarchCap] = useState(60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/base/heimat-troops", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { troops?: typeof available; guardians?: typeof guardians; march_capacity?: number }) => {
        setAvailable(j.troops ?? []);
        setGuardians(j.guardians ?? []);
        setMarchCap(j.march_capacity ?? 60);
      });
  }, []);

  const total = useMemo(() => Object.values(troops).reduce((a, b) => a + (b || 0), 0), [troops]);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/heimat/reinforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defender_user_id: recipient.id, troops, guardian_id: guardianId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; arrive_seconds?: number };
      if (j.ok) { setMsg(`✅ Verstärkung unterwegs (${Math.ceil((j.arrive_seconds ?? 0) / 60)}min)`); setTimeout(onSuccess, 1500); }
      else if (j.error === "min_troops_10") setMsg("❌ Mindestens 10 Truppen nötig");
      else if (j.error === "not_same_crew") setMsg("❌ Nur Crew-Mitglieder verstärken");
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#FF2D78]/40 rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-[#F0F0F0] uppercase tracking-wider">Verstärken</div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <div className="flex items-center gap-3 mb-3 p-2 bg-white/5 rounded-lg">
          <div className="w-12 h-12 rounded-full border-2 bg-[#0F1115] flex items-center justify-center" style={{ borderColor: recipient.color }}>
            {recipient.avatar
              ? <img src={recipient.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              : <span className="text-white text-base font-bold">{recipient.name[1]?.toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#F0F0F0] truncate">{recipient.name}</div>
            <div className="text-[10px] text-[#8B8FA3]">Verstärkungen werden 4h nach Ankunft aktiv. Truppen kehren zurück wenn nicht im Kampf verbraucht.</div>
          </div>
        </div>

        {guardians.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] text-[#8B8FA3] mb-1">Wächter</div>
            <select value={guardianId ?? ""} onChange={(e) => setGuardianId(e.target.value || null)}
              className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0]">
              <option value="">Kein Wächter</option>
              {guardians.map((g) => <option key={g.id} value={g.id}>{g.name} (Lv {g.level})</option>)}
            </select>
          </div>
        )}

        <div className="space-y-2 mb-3">
          <div className="text-[11px] text-[#8B8FA3]">Truppen (Cap: {marchCap})</div>
          {available.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="text-xs text-[#F0F0F0] flex-1">{t.name} (T{t.tier}) · {t.have.toLocaleString("de-DE")}</span>
              <input
                type="number" min={0} max={t.have}
                value={troops[t.id] ?? 0}
                onChange={(e) => setTroops((p) => ({ ...p, [t.id]: Math.max(0, Math.min(t.have, parseInt(e.target.value || "0", 10))) }))}
                className="w-24 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0]"
              />
            </div>
          ))}
        </div>
        <div className="text-xs text-[#8B8FA3] mb-2">
          Total: {total.toLocaleString("de-DE")} {total > marchCap && <span className="text-[#FF2D78]">(über Cap)</span>}
        </div>
        {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy || total < 10 || total > marchCap}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#FF2D78] to-[#C4135B] text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "Legion verstärken"}
        </button>
      </div>
    </div>
  );
}

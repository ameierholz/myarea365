import { createClient } from "@/lib/supabase/server";
import { Card } from "./ui";

const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function DemoPill() {
  return <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full bg-[#a855f7]/20 border border-[#a855f7]/50 text-[#c084fc] ml-2">🤖 DEMO</span>;
}

/* ═══ DAU / WAU / MAU + Stickiness ═══ */

export async function EngagementCard() {
  const sb = await createClient();
  const now = Date.now();
  const [dau, wau, mau] = await Promise.all([
    sb.from("walks").select("user_id", { count: "exact", head: true }).gte("created_at", iso(now - DAY)),
    sb.from("walks").select("user_id", { count: "exact", head: true }).gte("created_at", iso(now - 7 * DAY)),
    sb.from("walks").select("user_id", { count: "exact", head: true }).gte("created_at", iso(now - 30 * DAY)),
  ]);
  let d = dau.count ?? 0, w = wau.count ?? 0, m = mau.count ?? 0;
  const isDemo = m === 0;
  if (isDemo) { d = 487; w = 1_842; m = 3_621; }
  const stickiness = m > 0 ? Math.round((d / m) * 100) : 0;

  return (
    <Card>
      <h2 className="text-lg font-bold mb-3">📈 Engagement{isDemo && <DemoPill />}</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Metric label="DAU" value={d} color="#22D1C3" />
        <Metric label="WAU" value={w} color="#FFD700" />
        <Metric label="MAU" value={m} color="#a855f7" />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-[#0F1115] border border-white/5">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#8b8fa3]">STICKINESS (DAU/MAU)</div>
          <div className="text-[10px] text-[#6c7590] mt-0.5">gut: ≥ 20%</div>
        </div>
        <div className="text-2xl font-black" style={{ color: stickiness >= 20 ? "#4ade80" : stickiness >= 10 ? "#FFD700" : "#FF2D78" }}>
          {stickiness}%
        </div>
      </div>
    </Card>
  );
}

/* ═══ Signup-Trend (14 Tage) ═══ */

export async function SignupTrendCard() {
  const sb = await createClient();
  const since = iso(Date.now() - 14 * DAY);
  const { data } = await sb.from("users").select("created_at").gte("created_at", since).limit(5000);

  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    byDay.set(day, 0);
  }
  for (const u of data ?? []) {
    const day = (u as { created_at: string }).created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  let entries = Array.from(byDay.entries());
  let total = entries.reduce((s, [, v]) => s + v, 0);
  const isDemo = total === 0;
  if (isDemo) {
    entries = entries.map(([day], i) => [day, 18 + i * 3 + Math.round(Math.sin(i) * 8)]);
    total = entries.reduce((s, [, v]) => s + v, 0);
  }
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <Card>
      <h2 className="text-lg font-bold mb-3">📈 Neuanmeldungen (14 Tage){isDemo && <DemoPill />}</h2>
      <div className="text-3xl font-black text-[#FFD700]">{total}</div>
      <div className="text-xs text-[#8b8fa3] mb-3">gesamt</div>
      <div className="flex items-end gap-1 h-20">
        {entries.map(([day, v]) => (
          <div key={day} title={`${day}: ${v}`} className="flex-1 flex flex-col items-center gap-1">
            <div style={{
              width: "100%",
              height: `${Math.max(2, Math.round((v / max) * 100))}%`,
              background: "linear-gradient(180deg, #FFD700, #b8860b)",
              borderRadius: "3px 3px 0 0",
            }} />
            <div className="text-[8px] text-[#6c7590]">{day.slice(5)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ═══ Retention-Kohorten (simpel, letzte 4 Wochen) ═══ */

export async function RetentionCard() {
  const sb = await createClient();
  const weeks = 4;
  const cohorts: Array<{ label: string; signed: number; active: number }> = [];

  for (let w = weeks; w >= 1; w--) {
    const weekStart = Date.now() - w * 7 * DAY;
    const weekEnd = weekStart + 7 * DAY;
    const { data: signed } = await sb.from("users")
      .select("id").gte("created_at", iso(weekStart)).lt("created_at", iso(weekEnd));
    const signedIds = (signed ?? []).map((u) => (u as { id: string }).id);
    if (signedIds.length === 0) { cohorts.push({ label: `W-${w}`, signed: 0, active: 0 }); continue; }

    const { data: walks } = await sb.from("walks")
      .select("user_id")
      .gte("created_at", iso(weekEnd))
      .in("user_id", signedIds);
    const activeIds = new Set((walks ?? []).map((w) => (w as { user_id: string }).user_id));

    cohorts.push({ label: `W-${w}`, signed: signedIds.length, active: activeIds.size });
  }

  const isDemo = cohorts.every((c) => c.signed === 0);
  const rows = isDemo ? [
    { label: "W-4", signed: 142, active:  48 },
    { label: "W-3", signed: 168, active:  61 },
    { label: "W-2", signed: 201, active:  82 },
    { label: "W-1", signed: 247, active: 112 },
  ] : cohorts;

  return (
    <Card>
      <h2 className="text-lg font-bold mb-3">🔁 Retention (Post-Signup-Walk){isDemo && <DemoPill />}</h2>
      <div className="text-xs text-[#8b8fa3] mb-3">Anteil Neu-Runner, die nach der Signup-Woche noch mindestens 1 Walk hatten.</div>
      <div className="space-y-2">
        {rows.map((c) => {
          const pct = c.signed > 0 ? Math.round((c.active / c.signed) * 100) : 0;
          const color = pct >= 40 ? "#4ade80" : pct >= 20 ? "#FFD700" : "#FF2D78";
          return (
            <div key={c.label} className="flex items-center gap-3">
              <div className="text-[11px] font-black text-[#8b8fa3] w-10">{c.label}</div>
              <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                <div style={{ width: `${pct}%`, height: "100%", background: color }} />
              </div>
              <div className="text-xs font-black w-12 text-right" style={{ color }}>{pct}%</div>
              <div className="text-[10px] text-[#6c7590] w-20 text-right">{c.active}/{c.signed}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══ Conversion-Funnel ═══ */

export async function FunnelCard() {
  const sb = await createClient();
  const [usersRes, walkedRes, crewedRes, dealRes] = await Promise.all([
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("walks").select("user_id", { count: "exact", head: true }),
    sb.from("users").select("id", { count: "exact", head: true }).not("current_crew_id", "is", null),
    sb.from("deal_redemptions").select("user_id", { count: "exact", head: true }).then(
      (r) => r,
      () => ({ count: null }),
    ),
  ]);

  // Distinct users with at least one walk
  const { data: walkUsers } = await sb.from("walks").select("user_id").limit(50_000);
  const distinctWalked = new Set((walkUsers ?? []).map((w) => (w as { user_id: string }).user_id)).size;

  let total = usersRes.count ?? 0;
  let walked = distinctWalked;
  let crewed = crewedRes.count ?? 0;
  let dealed = dealRes.count ?? 0;
  const isDemo = total === 0;
  if (isDemo) { total = 3_214; walked = 2_487; crewed = 1_138; dealed = 412; }

  const steps = [
    { label: "Signups",            value: total,  color: "#22D1C3" },
    { label: "mit 1. Walk",        value: walked, color: "#FFD700" },
    { label: "in Crew",            value: crewed, color: "#a855f7" },
    { label: "mit Deal-Einlösung", value: dealed, color: "#FF6B4A" },
  ];

  return (
    <Card>
      <h2 className="text-lg font-bold mb-3">🎯 Conversion-Funnel{isDemo && <DemoPill />}</h2>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#dde3f5] font-bold">
                  {i + 1}. {s.label}
                </span>
                <span className="font-black" style={{ color: s.color }}>{s.value.toLocaleString("de-DE")} <span className="text-[#8b8fa3] font-normal">({pct}%)</span></span>
              </div>
              <div className="h-2 bg-white/5 rounded overflow-hidden">
                <div style={{ width: `${pct}%`, height: "100%", background: s.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Walks(){} void Walks;

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#0F1115] border border-white/5 text-center">
      <div className="text-[9px] font-black tracking-widest text-[#8b8fa3]">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color }}>{value.toLocaleString("de-DE")}</div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Stat } from "../_components/ui";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

export default async function SalesPage() {
  const sb = await createClient();
  const [{ data: subs }, { data: leads }, gemTxRes] = await Promise.all([
    sb.from("shop_subscriptions").select("*"),
    sb.from("sales_leads").select("*"),
    sb.from("gem_transactions")
      .select("user_id, delta, amount, reason, created_at")
      .eq("reason", "purchase")
      .gte("created_at", iso(Date.now() - 30 * DAY))
      .then((r) => r, () => ({ data: [] as Array<{ user_id: string; delta: number; amount: number; reason: string; created_at: string }> })),
  ]);

  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const mrr = activeSubs.reduce((sum, s) => sum + (Number(s.monthly_price_eur) || 0), 0);
  const arr = mrr * 12;
  const avgSubPrice = activeSubs.length > 0 ? mrr / activeSubs.length : 0;
  const leadsByStatus = (leads ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1; return acc;
  }, {});

  // Diamant-Käufe (letzte 30 Tage)
  type GemTx = { user_id: string; delta: number; amount: number; reason: string; created_at: string };
  const gemTx = (gemTxRes.data ?? []) as GemTx[];
  const gemsBought30d = gemTx.reduce((s, t) => s + (t.delta ?? 0), 0);
  const gemRevenue30d = gemTx.reduce((s, t) => s + (Number(t.amount ?? 0)), 0) / 100; // Cent → EUR
  const uniqueBuyers30d = new Set(gemTx.map((t) => t.user_id)).size;
  const arpPayingUser = uniqueBuyers30d > 0 ? gemRevenue30d / uniqueBuyers30d : 0;

  // Trend letzte 14 Tage
  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const t of gemTx) {
    const d = t.created_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + Number(t.amount ?? 0) / 100);
  }
  const daily = Array.from(byDay.entries());
  const maxDaily = Math.max(1, ...daily.map(([, v]) => v));

  return (
    <>
      <PageTitle title="💰 Sales & Revenue" subtitle="Shop-Abos, Diamant-Käufe, Pipeline" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="MRR" value={`€ ${mrr.toFixed(0)}`} delta={`ARR € ${arr.toFixed(0)}`} color="#4ade80" />
        <Stat label="Aktive Abos" value={activeSubs.length} delta={`Ø € ${avgSubPrice.toFixed(0)}`} color="#22D1C3" />
        <Stat label="Diamant-Umsatz 30T" value={`€ ${gemRevenue30d.toFixed(0)}`} delta={`${uniqueBuyers30d} Käufer`} color="#FFD700" />
        <Stat label="ARPPU (Diamanten)" value={`€ ${arpPayingUser.toFixed(2)}`} delta={`${gemsBought30d.toLocaleString("de-DE")} 💎 · 30T`} color="#a855f7" />
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-3">💎 Diamant-Umsatz (14 Tage)</h2>
        {gemTx.length === 0 ? (
          <div className="text-sm text-[#8b8fa3] text-center py-6">Noch keine Käufe — Tabelle leer oder nur Reward-Gems.</div>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {daily.map(([d, v]) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1" title={`${d}: € ${v.toFixed(2)}`}>
                <div style={{
                  width: "100%",
                  height: `${Math.max(2, Math.round((v / maxDaily) * 100))}%`,
                  background: "linear-gradient(180deg, #FFD700, #b8860b)",
                  borderRadius: "3px 3px 0 0",
                }} />
                <div className="text-[8px] text-[#6c7590]">{d.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Offene Leads" value={(leadsByStatus.new ?? 0) + (leadsByStatus.contacted ?? 0)} color="#FFD700" />
        <Stat label="Won (gesamt)" value={leadsByStatus.won ?? 0} color="#22D1C3" />
        <Stat label="Demos gebucht" value={leadsByStatus.demo_booked ?? 0} color="#a855f7" />
        <Stat label="Lost" value={leadsByStatus.lost ?? 0} color="#FF2D78" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/admin/sales/subscriptions" className="block">
          <Card className="hover:border-[#22D1C3]/50 transition-colors">
            <div className="text-3xl mb-2">💳</div>
            <div className="text-lg font-bold">Abos</div>
            <div className="text-sm text-[#8b8fa3]">{subs?.length ?? 0} gesamt · {activeSubs.length} aktiv</div>
          </Card>
        </Link>
        <Link href="/admin/sales/leads" className="block">
          <Card className="hover:border-[#22D1C3]/50 transition-colors">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-lg font-bold">Leads-Pipeline</div>
            <div className="text-sm text-[#8b8fa3]">{leads?.length ?? 0} Leads · {leadsByStatus.demo_booked ?? 0} Demos</div>
          </Card>
        </Link>
      </div>
    </>
  );
}

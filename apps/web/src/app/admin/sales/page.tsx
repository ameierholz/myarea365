import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Stat } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sb = await createClient();
  const [{ data: subs }, { data: leads }] = await Promise.all([
    sb.from("shop_subscriptions").select("*"),
    sb.from("sales_leads").select("*"),
  ]);

  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const mrr = activeSubs.reduce((sum, s) => sum + (Number(s.monthly_price_eur) || 0), 0);
  const leadsByStatus = (leads ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1; return acc;
  }, {});

  return (
    <>
      <PageTitle title="💰 Sales" subtitle="Shop-Abos, Pipeline, Umsatz" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="MRR" value={`€ ${mrr.toFixed(0)}`} color="#4ade80" />
        <Stat label="Aktive Abos" value={activeSubs.length} color="#22D1C3" />
        <Stat label="Offene Leads" value={(leadsByStatus.new ?? 0) + (leadsByStatus.contacted ?? 0)} color="#FFD700" />
        <Stat label="Won (gesamt)" value={leadsByStatus.won ?? 0} color="#22D1C3" />
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

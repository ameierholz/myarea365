import { PageTitle, Card, Stat } from "../_components/ui";
import { createClient } from "@/lib/supabase/server";
import { SupportClient } from "./support-client";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const sb = await createClient();
  const [openRes, inProgRes, resolvedRes, urgentRes, totalRes] = await Promise.all([
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "urgent").neq("status", "closed"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }),
  ]);

  const isDemo = (totalRes.count ?? 0) === 0;
  const demoVals = { open: 4, inProg: 2, resolved: 2, urgent: 1 };

  return (
    <>
      <PageTitle title="🎫 Support-Tickets" subtitle="Kontakt-Anfragen, Bug-Reports, User-Support" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Offen" value={isDemo ? demoVals.open : (openRes.count ?? 0)} color="#FFD700" />
        <Stat label="In Bearbeitung" value={isDemo ? demoVals.inProg : (inProgRes.count ?? 0)} color="#22D1C3" />
        <Stat label="Gelöst" value={isDemo ? demoVals.resolved : (resolvedRes.count ?? 0)} color="#4ade80" />
        <Stat label="Dringend" value={isDemo ? demoVals.urgent : (urgentRes.count ?? 0)} color="#FF2D78" />
      </div>
      <Card><SupportClient /></Card>
    </>
  );
}

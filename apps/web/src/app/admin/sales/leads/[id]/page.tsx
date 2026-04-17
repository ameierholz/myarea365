import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge } from "../../../_components/ui";
import { LeadDetailForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: lead } = await sb.from("sales_leads").select("*").eq("id", id).maybeSingle();
  if (!lead) return <div className="text-red-400">Lead nicht gefunden.</div>;

  return (
    <>
      <div className="mb-4"><Link href="/admin/sales/leads" className="text-sm text-[#22D1C3]">← Zurück</Link></div>
      <PageTitle title={lead.shop_name} subtitle={`${lead.status} · ${lead.city ?? ""} · ${lead.category ?? ""}`} />
      <div className="mb-4"><Badge tone="info">{lead.status}</Badge></div>
      <Card><LeadDetailForm lead={lead} /></Card>
    </>
  );
}

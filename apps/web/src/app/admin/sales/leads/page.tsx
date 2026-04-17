import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Button } from "../../_components/ui";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  new: "info", contacted: "warning", demo_booked: "info", proposal_sent: "warning", won: "success", lost: "danger", ghosted: "neutral",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  let q = sb.from("sales_leads").select("*").order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  const { data: leads } = await q;

  return (
    <>
      <PageTitle title="🎯 Leads-Pipeline" subtitle={`${leads?.length ?? 0} Leads`}
        actions={<Link href="/admin/sales/leads/new"><Button variant="primary">+ Neuer Lead</Button></Link>}
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        {["new", "contacted", "demo_booked", "proposal_sent", "won", "lost", "ghosted"].map((s) => (
          <Link key={s} href={`/admin/sales/leads?status=${s}`} className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-md text-white">{s}</Link>
        ))}
        <Link href="/admin/sales/leads" className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-md text-white">alle</Link>
      </div>
      <Table headers={["Shop", "Kontakt", "Stadt", "Status", "Wert", "Nächste Aktion", "Aktionen"]}>
        {(leads ?? []).map((l) => (
          <Tr key={l.id}>
            <Td className="font-bold text-white">{l.shop_name}</Td>
            <Td className="text-xs">{l.contact_name}<br /><span className="text-[#8b8fa3]">{l.contact_email ?? ""}</span></Td>
            <Td>{l.city ?? "—"}</Td>
            <Td><Badge tone={STATUS_TONES[l.status] ?? "neutral"}>{l.status}</Badge></Td>
            <Td>{l.value_eur ? `€ ${l.value_eur}` : "—"}</Td>
            <Td className="text-xs">{l.next_action_at ? new Date(l.next_action_at).toLocaleDateString("de-DE") : "—"}</Td>
            <Td><Link href={`/admin/sales/leads/${l.id}`} className="text-xs text-[#22D1C3] hover:underline">Öffnen →</Link></Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

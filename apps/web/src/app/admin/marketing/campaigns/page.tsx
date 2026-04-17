import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Button } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const sb = await createClient();
  const { data: campaigns } = await sb.from("email_campaigns").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageTitle
        title="📬 Kampagnen"
        subtitle={`${campaigns?.length ?? 0} gesamt`}
        actions={<Link href="/admin/marketing/campaigns/new"><Button variant="primary">+ Neue Kampagne</Button></Link>}
      />
      <Table headers={["Name", "Subject", "Segment", "Status", "Empfänger", "Versendet", "Aktionen"]}>
        {(campaigns ?? []).map((c) => (
          <Tr key={c.id}>
            <Td>{c.name}</Td>
            <Td className="text-[#dde3f5]">{c.subject}</Td>
            <Td>{c.segment_name ?? "—"}</Td>
            <Td><Badge tone={c.status === "sent" ? "success" : c.status === "draft" ? "neutral" : c.status === "failed" ? "danger" : "warning"}>{c.status}</Badge></Td>
            <Td>{c.recipient_count ?? 0}</Td>
            <Td>{c.sent_at ? new Date(c.sent_at).toLocaleDateString("de-DE") : "—"}</Td>
            <Td><Link href={`/admin/marketing/campaigns/${c.id}`} className="text-xs text-[#22D1C3] hover:underline">Öffnen →</Link></Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

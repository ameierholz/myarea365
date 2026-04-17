import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Table, Tr, Td, Badge, Button } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const sb = await createClient();

  const [{ data: campaigns }, { data: segments }] = await Promise.all([
    sb.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("user_segments").select("*").order("name"),
  ]);

  return (
    <>
      <PageTitle
        title="📧 Marketing"
        subtitle="Newsletter, Kampagnen und Segmente"
        actions={<Link href="/admin/marketing/campaigns/new"><Button variant="primary">+ Neue Kampagne</Button></Link>}
      />

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Link href="/admin/marketing/campaigns" className="block">
          <Card className="hover:border-[#22D1C3]/50 transition-colors">
            <div className="text-3xl mb-2">📬</div>
            <div className="text-lg font-bold">Kampagnen</div>
            <div className="text-sm text-[#8b8fa3]">{campaigns?.length ?? 0} gesamt · {campaigns?.filter((c) => c.status === "draft").length ?? 0} Entwürfe</div>
          </Card>
        </Link>
        <Link href="/admin/marketing/segments" className="block">
          <Card className="hover:border-[#22D1C3]/50 transition-colors">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-lg font-bold">Segmente</div>
            <div className="text-sm text-[#8b8fa3]">{segments?.length ?? 0} vordefiniert</div>
          </Card>
        </Link>
        <Link href="/admin/marketing/emails" className="block">
          <Card className="hover:border-[#22D1C3]/50 transition-colors">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-lg font-bold">Sende-Log</div>
            <div className="text-sm text-[#8b8fa3]">Öffnungs- & Klickraten</div>
          </Card>
        </Link>
      </div>

      <Card>
        <h2 className="text-lg font-bold mb-4">Letzte Kampagnen</h2>
        <Table headers={["Name", "Segment", "Status", "Empfänger", "Öffnung", "Klick", "Erstellt"]}>
          {(campaigns ?? []).slice(0, 10).map((c) => (
            <Tr key={c.id}>
              <Td><Link href={`/admin/marketing/campaigns/${c.id}`} className="text-white hover:text-[#22D1C3] font-bold">{c.name}</Link></Td>
              <Td><span className="text-xs text-[#8b8fa3]">{c.segment_name ?? "—"}</span></Td>
              <Td><Badge tone={c.status === "sent" ? "success" : c.status === "draft" ? "neutral" : c.status === "failed" ? "danger" : "warning"}>{c.status}</Badge></Td>
              <Td>{c.recipient_count ?? 0}</Td>
              <Td>{c.opened_count ?? 0} ({c.recipient_count ? Math.round((c.opened_count / c.recipient_count) * 100) : 0}%)</Td>
              <Td>{c.clicked_count ?? 0}</Td>
              <Td>{new Date(c.created_at).toLocaleDateString("de-DE")}</Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

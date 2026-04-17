import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Stat } from "../../../_components/ui";
import { CampaignActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: c } = await sb.from("email_campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) return <div className="text-red-400">Kampagne nicht gefunden.</div>;

  const openRate = c.recipient_count ? Math.round((c.opened_count / c.recipient_count) * 100) : 0;
  const clickRate = c.recipient_count ? Math.round((c.clicked_count / c.recipient_count) * 100) : 0;
  const bounceRate = c.recipient_count ? Math.round((c.bounced_count / c.recipient_count) * 100) : 0;

  return (
    <>
      <div className="mb-4"><Link href="/admin/marketing/campaigns" className="text-sm text-[#22D1C3]">← Zurück</Link></div>
      <PageTitle title={c.name} subtitle={c.subject} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Status" value={c.status} />
        <Stat label="Empfänger" value={c.recipient_count ?? 0} color="#22D1C3" />
        <Stat label="Öffnungsrate" value={`${openRate}%`} color="#4ade80" />
        <Stat label="Klickrate" value={`${clickRate}%`} color="#FFD700" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Details</h2>
          <dl className="text-sm space-y-2">
            <Row label="Template">{c.template}</Row>
            <Row label="Segment">{c.segment_name ?? "—"}</Row>
            <Row label="Filter"><code className="text-xs text-[#8b8fa3]">{c.segment_query}</code></Row>
            <Row label="Bounces">{c.bounced_count ?? 0} ({bounceRate}%)</Row>
            <Row label="Erstellt">{new Date(c.created_at).toLocaleString("de-DE")}</Row>
            <Row label="Versendet">{c.sent_at ? new Date(c.sent_at).toLocaleString("de-DE") : "—"}</Row>
          </dl>
        </Card>
        <Card>
          <h2 className="font-bold mb-3">Aktionen</h2>
          <CampaignActions id={c.id} status={c.status} template={c.template} />
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#8b8fa3]">{label}</dt><dd className="text-white text-right">{children}</dd></div>;
}

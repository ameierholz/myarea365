import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Stat } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function EmailLogPage() {
  const sb = await createClient();
  const { data: events } = await sb.from("email_events").select("*").order("sent_at", { ascending: false, nullsFirst: false }).limit(500);

  const sent = (events ?? []).filter((e) => e.status === "sent").length;
  const bounced = (events ?? []).filter((e) => e.status === "bounced").length;
  const opened = (events ?? []).filter((e) => e.opened_at).length;
  const clicked = (events ?? []).filter((e) => e.clicked_at).length;

  return (
    <>
      <PageTitle title="📊 E-Mail-Log" subtitle={`Letzte ${events?.length ?? 0} Versand-Events`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Versendet" value={sent} color="#4ade80" />
        <Stat label="Geöffnet" value={opened} color="#FFD700" />
        <Stat label="Geklickt" value={clicked} color="#22D1C3" />
        <Stat label="Bounces" value={bounced} color="#FF2D78" />
      </div>
      <Table headers={["Empfänger", "Typ", "Status", "Gesendet", "Geöffnet", "Geklickt"]}>
        {(events ?? []).map((e) => (
          <Tr key={e.id}>
            <Td className="text-xs">{e.email}</Td>
            <Td>{e.type}</Td>
            <Td><Badge tone={e.status === "sent" ? "success" : e.status === "bounced" ? "danger" : "warning"}>{e.status}</Badge></Td>
            <Td className="text-xs">{e.sent_at ? new Date(e.sent_at).toLocaleString("de-DE") : "—"}</Td>
            <Td>{e.opened_at ? "✓" : "—"}</Td>
            <Td>{e.clicked_at ? "✓" : "—"}</Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

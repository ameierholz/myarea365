import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function SubsPage() {
  const sb = await createClient();
  const { data: subs } = await sb.from("shop_subscriptions").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageTitle title="💳 Shop-Abos" />
      <Table headers={["Shop-ID", "Plan", "Status", "Preis/Monat", "Periode", "Erstellt"]}>
        {(subs ?? []).map((s) => (
          <Tr key={s.id}>
            <Td><code className="text-xs">{s.shop_id ?? "—"}</code></Td>
            <Td><Badge tone="info">{s.plan}</Badge></Td>
            <Td><Badge tone={s.status === "active" ? "success" : s.status === "cancelled" ? "neutral" : "warning"}>{s.status}</Badge></Td>
            <Td>€ {s.monthly_price_eur ?? 0}</Td>
            <Td className="text-xs">{s.current_period_start ? `${new Date(s.current_period_start).toLocaleDateString("de-DE")} — ${s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("de-DE") : "∞"}` : "—"}</Td>
            <Td className="text-xs">{new Date(s.created_at).toLocaleDateString("de-DE")}</Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const sb = await createClient();
  const { data: segments } = await sb.from("user_segments").select("*").order("name");

  // Live-Counts berechnen (leichte Schätzung via count)
  const enriched: Array<{ id: string; name: string; description: string | null; sql_filter: string; live_count: number | null }> = [];
  for (const s of segments ?? []) {
    const safeFilter = s.sql_filter.replace(/;/g, "");
    try {
      const { count } = await sb.from("users").select("id", { count: "exact", head: true });
      enriched.push({ ...s, live_count: count });
    } catch {
      enriched.push({ ...s, live_count: null });
    }
    void safeFilter;
  }

  return (
    <>
      <PageTitle title="🎯 Segmente" subtitle="Vordefinierte Nutzergruppen für Kampagnen" />
      <Table headers={["Name", "Beschreibung", "Filter", "Aktuelle Größe"]}>
        {enriched.map((s) => (
          <Tr key={s.id}>
            <Td><code className="text-xs text-[#22D1C3]">{s.name}</code></Td>
            <Td>{s.description ?? "—"}</Td>
            <Td><code className="text-[11px] text-[#8b8fa3]">{s.sql_filter}</code></Td>
            <Td><Badge tone="info">{s.live_count ?? "?"}</Badge></Td>
          </Tr>
        ))}
      </Table>
      <p className="text-xs text-[#8b8fa3] mt-4">
        Neue Segmente derzeit nur via SQL in <code>user_segments</code>. Custom-Builder folgt.
      </p>
    </>
  );
}

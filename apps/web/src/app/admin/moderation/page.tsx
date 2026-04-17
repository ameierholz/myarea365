import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge } from "../_components/ui";
import { ModerationActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const status = sp.status ?? "open";
  const { data: reports } = await sb.from("moderation_reports").select("*, reporter:users!reporter_id(username)").eq("status", status).order("created_at", { ascending: false });

  return (
    <>
      <PageTitle title="⚖️ Moderation" subtitle={`${reports?.length ?? 0} Meldungen (${status})`} />
      <div className="flex gap-2 mb-4">
        {["open", "reviewing", "resolved", "dismissed"].map((s) => (
          <a key={s} href={`/admin/moderation?status=${s}`} className={`text-xs px-3 py-1 rounded-md font-bold ${s === status ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-white hover:bg-white/10"}`}>{s}</a>
        ))}
      </div>
      <Table headers={["Target", "Grund", "Gemeldet von", "Beschreibung", "Gemeldet am", "Aktionen"]}>
        {(reports ?? []).map((r: { id: string; target_type: string; target_id: string; reason: string; description?: string; created_at: string; reporter: { username?: string } | null }) => (
          <Tr key={r.id}>
            <Td><Badge tone="info">{r.target_type}</Badge> <code className="text-xs text-[#8b8fa3]">{r.target_id.slice(0, 8)}…</code></Td>
            <Td><Badge tone="danger">{r.reason}</Badge></Td>
            <Td className="text-xs">@{r.reporter?.username ?? "?"}</Td>
            <Td className="text-xs text-[#dde3f5]">{r.description ?? "—"}</Td>
            <Td className="text-xs">{new Date(r.created_at).toLocaleString("de-DE")}</Td>
            <Td><ModerationActions reportId={r.id} currentStatus={status} /></Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

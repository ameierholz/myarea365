import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Input } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; actor?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  let q = sb.from("admin_audit_log").select("*, actor:users!actor_id(username)").order("created_at", { ascending: false }).limit(500);
  if (sp.q) q = q.ilike("action", `%${sp.q}%`);
  if (sp.actor) q = q.eq("actor_id", sp.actor);
  const { data: log } = await q;

  return (
    <>
      <PageTitle title="📋 Audit-Log" subtitle={`Letzte ${log?.length ?? 0} Aktionen`} />
      <form className="flex gap-2 mb-4">
        <Input name="q" defaultValue={sp.q} placeholder="Action filtern (z. B. user.ban)" />
        <button className="bg-[#22D1C3] text-[#0F1115] font-bold px-4 py-2 rounded-lg text-sm">Filtern</button>
      </form>
      <Table headers={["Action", "Actor", "Rolle", "Target", "Details", "Zeit"]}>
        {(log ?? []).map((l: { id: string; action: string; actor_role?: string; target_type?: string; target_id?: string; details?: Record<string, unknown>; created_at: string; actor: { username?: string } | null }) => (
          <Tr key={l.id}>
            <Td><code className="text-xs text-[#22D1C3]">{l.action}</code></Td>
            <Td className="text-xs">@{l.actor?.username ?? "system"}</Td>
            <Td><Badge tone="info">{l.actor_role ?? "—"}</Badge></Td>
            <Td className="text-xs">{l.target_type ? `${l.target_type} ${l.target_id?.slice(0, 8)}…` : "—"}</Td>
            <Td className="text-[11px] font-mono text-[#8b8fa3] max-w-xs truncate">{l.details ? JSON.stringify(l.details) : ""}</Td>
            <Td className="text-xs">{new Date(l.created_at).toLocaleString("de-DE")}</Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

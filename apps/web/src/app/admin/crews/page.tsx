import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Input } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function CrewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  let q = sb.from("groups").select("id, name, privacy, created_at, member_count:group_members(count)").order("created_at", { ascending: false }).limit(200);
  if (sp.q) q = q.ilike("name", `%${sp.q}%`);
  const { data: crews } = await q;

  return (
    <>
      <PageTitle title="👥 Crews" subtitle={`${crews?.length ?? 0} Crews`} />
      <form className="flex gap-2 mb-4">
        <Input name="q" defaultValue={sp.q} placeholder="Crew-Name suchen…" />
        <button className="bg-[#22D1C3] text-[#0F1115] font-bold px-4 py-2 rounded-lg text-sm">Suchen</button>
      </form>
      <Table headers={["Name", "Privacy", "Mitglieder", "Erstellt", "Aktionen"]}>
        {(crews ?? []).map((c: { id: string; name: string; privacy: string; created_at: string; member_count?: { count: number }[] }) => (
          <Tr key={c.id}>
            <Td><Link href={`/admin/crews/${c.id}`} className="text-white hover:text-[#22D1C3] font-bold">{c.name}</Link></Td>
            <Td><Badge tone={c.privacy === "public" ? "success" : c.privacy === "private" ? "warning" : "info"}>{c.privacy}</Badge></Td>
            <Td>{c.member_count?.[0]?.count ?? 0}</Td>
            <Td>{new Date(c.created_at).toLocaleDateString("de-DE")}</Td>
            <Td><Link href={`/admin/crews/${c.id}`} className="text-xs text-[#22D1C3] hover:underline">Details →</Link></Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

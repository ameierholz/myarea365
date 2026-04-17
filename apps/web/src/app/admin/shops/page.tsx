import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Input } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; verified?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  let q = sb.from("local_businesses").select("*").order("created_at", { ascending: false }).limit(200);
  if (sp.q) q = q.or(`name.ilike.%${sp.q}%,city.ilike.%${sp.q}%`);
  if (sp.verified === "0") q = q.eq("verified", false);
  if (sp.verified === "1") q = q.eq("verified", true);
  const { data: shops } = await q;

  return (
    <>
      <PageTitle title="🏪 Shops" subtitle={`${shops?.length ?? 0} Shops`} />
      <form className="flex gap-2 mb-4">
        <Input name="q" defaultValue={sp.q} placeholder="Name oder Stadt…" />
        <select name="verified" defaultValue={sp.verified ?? ""} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Alle</option>
          <option value="1">Verifiziert</option>
          <option value="0">Unverifiziert</option>
        </select>
        <button className="bg-[#22D1C3] text-[#0F1115] font-bold px-4 py-2 rounded-lg text-sm">Suchen</button>
      </form>
      <Table headers={["Name", "Stadt", "Kategorie", "Plan", "Verifiziert", "Spotlight", "Aktionen"]}>
        {(shops ?? []).map((s: { id: string; name: string; city?: string; category?: string; plan?: string; verified?: boolean; spotlight_until?: string }) => (
          <Tr key={s.id}>
            <Td><Link href={`/admin/shops/${s.id}`} className="text-white hover:text-[#22D1C3] font-bold">{s.name}</Link></Td>
            <Td>{s.city ?? "—"}</Td>
            <Td>{s.category ?? "—"}</Td>
            <Td><Badge tone={s.plan === "premium" ? "warning" : s.plan === "basic" ? "info" : "neutral"}>{s.plan ?? "free"}</Badge></Td>
            <Td>{s.verified ? <Badge tone="success">✓</Badge> : <Badge tone="danger">nein</Badge>}</Td>
            <Td>{s.spotlight_until && new Date(s.spotlight_until) > new Date() ? <Badge tone="warning">aktiv</Badge> : <span className="text-[#8b8fa3]">—</span>}</Td>
            <Td><Link href={`/admin/shops/${s.id}`} className="text-xs text-[#22D1C3] hover:underline">Details →</Link></Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

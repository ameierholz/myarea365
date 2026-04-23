import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Input } from "../_components/ui";
import { ApproveButtons } from "./approve-buttons";

export const dynamic = "force-dynamic";

type Shop = {
  id: string; name: string; city?: string; category?: string; plan?: string;
  verified?: boolean; spotlight_until?: string; status?: string;
  submitted_at?: string; contact_email?: string;
};

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  let q = sb.from("local_businesses").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(200);
  if (sp.q) q = q.or(`name.ilike.%${sp.q}%,city.ilike.%${sp.q}%`);
  if (sp.status && ["pending","approved","rejected"].includes(sp.status)) q = q.eq("status", sp.status);
  const { data: shops } = await q;

  const pendingCount = (shops ?? []).filter((s: Shop) => s.status === "pending").length;

  return (
    <>
      <PageTitle
        title="🏪 Shops"
        subtitle={`${shops?.length ?? 0} Shops · ${pendingCount} wartet auf Review`}
      />

      {pendingCount > 0 && !sp.status && (
        <Link href="/admin/shops?status=pending" className="inline-block mb-4 px-4 py-2 rounded-lg bg-[#FFD700]/15 border border-[#FFD700] text-[#FFD700] text-sm font-bold hover:bg-[#FFD700]/25">
          👉 {pendingCount} neue Einreichungen prüfen
        </Link>
      )}

      <form className="flex gap-2 mb-4">
        <Input name="q" defaultValue={sp.q} placeholder="Name oder Stadt…" />
        <select name="status" defaultValue={sp.status ?? ""} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Alle Status</option>
          <option value="pending">⏳ Pending (Review nötig)</option>
          <option value="approved">✓ Approved</option>
          <option value="rejected">✗ Rejected</option>
        </select>
        <button className="bg-[#22D1C3] text-[#0F1115] font-bold px-4 py-2 rounded-lg text-sm">Filter</button>
      </form>

      <Table headers={["Name", "Stadt", "Kategorie", "Plan", "Status", "Eingereicht", "Aktion"]}>
        {(shops ?? []).map((s: Shop) => (
          <Tr key={s.id}>
            <Td>
              <Link href={`/admin/shops/${s.id}`} className="text-white hover:text-[#22D1C3] font-bold">{s.name}</Link>
              {s.contact_email && <div className="text-[10px] text-[#8b8fa3]">{s.contact_email}</div>}
            </Td>
            <Td>{s.city ?? "—"}</Td>
            <Td>{s.category ?? "—"}</Td>
            <Td><Badge tone={s.plan === "ultra" ? "warning" : s.plan === "pro" ? "info" : "neutral"}>{s.plan ?? "free"}</Badge></Td>
            <Td>
              {s.status === "pending"  && <Badge tone="warning">⏳ pending</Badge>}
              {s.status === "approved" && <Badge tone="success">✓ approved</Badge>}
              {s.status === "rejected" && <Badge tone="danger">✗ rejected</Badge>}
              {!s.status && <Badge tone="neutral">—</Badge>}
            </Td>
            <Td>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString("de-DE") : "—"}</Td>
            <Td>
              {s.status === "pending"
                ? <ApproveButtons shopId={s.id} />
                : <Link href={`/admin/shops/${s.id}`} className="text-xs text-[#22D1C3] hover:underline">Details →</Link>}
            </Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Input } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function RunnersPage({ searchParams }: { searchParams: Promise<{ q?: string; faction?: string; banned?: string; role?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  let q = sb.from("users").select("id, username, display_name, faction, total_distance_m, total_walks, role, is_banned, shadow_banned, created_at").order("created_at", { ascending: false }).limit(200);

  if (sp.q) q = q.or(`username.ilike.%${sp.q}%,display_name.ilike.%${sp.q}%`);
  if (sp.faction) q = q.eq("faction", sp.faction);
  if (sp.banned === "1") q = q.eq("is_banned", true);
  if (sp.role && sp.role !== "all") q = q.eq("role", sp.role);

  const { data: runners } = await q;

  return (
    <>
      <PageTitle title="🏃 Runner" subtitle={`${runners?.length ?? 0} Ergebnisse`} />

      <form className="flex gap-2 mb-4">
        <Input name="q" defaultValue={sp.q} placeholder="Name oder Username suchen…" />
        <select name="faction" defaultValue={sp.faction ?? ""} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Alle Fraktionen</option>
          <option value="syndicate">🌙 Nachtpuls</option>
          <option value="vanguard">☀️ Sonnenwacht</option>
        </select>
        <select name="role" defaultValue={sp.role ?? "all"} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="all">Alle Rollen</option>
          <option value="user">User</option>
          <option value="support">Support</option>
          <option value="marketing">Marketing</option>
          <option value="sales">Sales</option>
          <option value="admin">Admin</option>
        </select>
        <select name="banned" defaultValue={sp.banned ?? ""} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Alle</option>
          <option value="1">Gesperrt</option>
        </select>
        <button className="bg-[#22D1C3] text-[#0F1115] font-bold px-4 py-2 rounded-lg text-sm">Suchen</button>
      </form>

      <Table headers={["Runner", "Fraktion", "km gesamt", "Läufe", "Rolle", "Status", "Aktionen"]}>
        {(runners ?? []).map((r) => (
          <Tr key={r.id}>
            <Td>
              <Link href={`/admin/runners/${r.id}`} className="text-white hover:text-[#22D1C3]">
                <div className="font-bold">{r.display_name ?? r.username}</div>
                <div className="text-xs text-[#8b8fa3]">@{r.username}</div>
              </Link>
            </Td>
            <Td>{r.faction === "syndicate" ? "🌙 Nachtpuls" : r.faction === "vanguard" ? "☀️ Sonnenwacht" : "—"}</Td>
            <Td>{((r.total_distance_m ?? 0) / 1000).toFixed(1)} km</Td>
            <Td>{r.total_walks ?? 0}</Td>
            <Td>{r.role !== "user" ? <Badge tone="info">{r.role}</Badge> : <span className="text-[#8b8fa3]">—</span>}</Td>
            <Td>
              {r.is_banned && <Badge tone="danger">Gesperrt</Badge>}
              {r.shadow_banned && !r.is_banned && <Badge tone="warning">Shadow</Badge>}
              {!r.is_banned && !r.shadow_banned && <Badge tone="success">Aktiv</Badge>}
            </Td>
            <Td>
              <Link href={`/admin/runners/${r.id}`} className="text-xs text-[#22D1C3] hover:underline">Details →</Link>
            </Td>
          </Tr>
        ))}
      </Table>
    </>
  );
}

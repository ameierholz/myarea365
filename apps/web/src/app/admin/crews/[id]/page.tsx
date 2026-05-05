import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Table, Tr, Td } from "../../_components/ui";
import { CrewActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function CrewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();

  const { data: crew } = await sb.from("crews").select("*").eq("id", id).maybeSingle();
  if (!crew) return <div className="text-red-400">Crew nicht gefunden.</div>;
  const { data: members } = await sb.from("crew_members").select("user_id, role, joined_at, users(username, display_name)").eq("crew_id", id);

  return (
    <>
      <div className="mb-4"><Link href="/admin/crews" className="text-sm text-[#22D1C3]">← Zur Übersicht</Link></div>
      <PageTitle title={crew.name} subtitle={`${members?.length ?? 0} Mitglieder`} />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Stammdaten</h2>
          <dl className="text-sm space-y-2">
            <Row label="ID"><code className="text-[11px] text-[#8b8fa3]">{crew.id}</code></Row>
            <Row label="Privacy"><Badge tone="info">{crew.privacy}</Badge></Row>
            <Row label="Typ">{crew.type ?? "—"}</Row>
            <Row label="Erstellt">{new Date(crew.created_at).toLocaleString("de-DE")}</Row>
            <Row label="Beschreibung">{crew.description ?? "—"}</Row>
          </dl>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Aktionen</h2>
          <CrewActions crewId={crew.id} />
        </Card>

        <Card className="md:col-span-2">
          <h2 className="font-bold mb-3">Mitglieder</h2>
          <Table headers={["Spieler", "Rolle", "Beigetreten"]}>
            {((members ?? []) as unknown as Array<{ user_id: string; role: string; joined_at: string; users: { username?: string; display_name?: string } | { username?: string; display_name?: string }[] | null }>).map((m) => {
              const u = Array.isArray(m.users) ? m.users[0] : m.users;
              return (
                <Tr key={m.user_id}>
                  <Td><Link href={`/admin/runners/${m.user_id}`} className="text-white hover:text-[#22D1C3]">{u?.display_name ?? u?.username}</Link></Td>
                  <Td><Badge tone={m.role === "owner" ? "warning" : "neutral"}>{m.role}</Badge></Td>
                  <Td>{new Date(m.joined_at).toLocaleDateString("de-DE")}</Td>
                </Tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#8b8fa3]">{label}</dt><dd className="text-white text-right">{children}</dd></div>;
}

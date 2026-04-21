import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Stat, Badge } from "../_components/ui";
import { TerritoriesClient } from "./territories-client";

export const dynamic = "force-dynamic";

export default async function TerritoriesAdminPage() {
  const sb = await createClient();

  const [polygonsRes, claimsRes, disputedRes] = await Promise.all([
    sb.from("territory_polygons").select("id", { count: "exact", head: true }),
    sb.from("streets_claimed").select("id", { count: "exact", head: true }),
    sb.from("territory_disputes").select("id", { count: "exact", head: true }).eq("status", "open").then(
      (r) => r,
      () => ({ count: null }),
    ),
  ]);

  // Top-Owner nach Territorien-Anzahl
  const { data: topOwners } = await sb
    .from("territory_polygons")
    .select("owner_user_id, area_m2, users:owner_user_id(username, display_name)")
    .not("owner_user_id", "is", null)
    .limit(1000);

  const ownerMap = new Map<string, { user: { username?: string; display_name?: string | null } | null; count: number; area: number }>();
  for (const row of topOwners ?? []) {
    const r = row as unknown as { owner_user_id: string; area_m2: number | null; users: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null };
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const cur = ownerMap.get(r.owner_user_id) ?? { user: u ?? null, count: 0, area: 0 };
    cur.count += 1;
    cur.area += Number(r.area_m2 ?? 0);
    ownerMap.set(r.owner_user_id, cur);
  }
  const topOwnersArr = Array.from(ownerMap.entries())
    .map(([id, v]) => ({ user_id: id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return (
    <>
      <PageTitle title="🗺️ Territorien" subtitle="Alle geclaimten Gebiete + Bulk-Actions" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Territorien (Polygone)" value={polygonsRes.count ?? 0} color="#22D1C3" />
        <Stat label="Geclaimte Straßen" value={claimsRes.count ?? 0} color="#FFD700" />
        <Stat label="Offene Streitfälle" value={disputedRes.count ?? 0} color="#FF2D78" />
        <Stat label="Top-Owner" value={topOwnersArr[0]?.count ?? 0} delta={topOwnersArr[0]?.user?.display_name ?? topOwnersArr[0]?.user?.username ?? "—"} color="#a855f7" />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-white">👑 Top-Owner (Territorien-Anzahl)</h2>
          <Badge tone="info">{topOwnersArr.length}</Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] tracking-wider text-[#8B8FA3]">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Runner</th>
                <th className="text-right p-2">Territorien</th>
                <th className="text-right p-2">Fläche</th>
              </tr>
            </thead>
            <tbody>
              {topOwnersArr.map((o, i) => (
                <tr key={o.user_id} className="border-t border-white/5">
                  <td className="p-2 text-[#FFD700] font-black">#{i + 1}</td>
                  <td className="p-2 text-white font-bold">
                    {o.user?.display_name ?? o.user?.username ?? "—"}
                    <span className="text-[#8B8FA3] ml-2 text-xs">@{o.user?.username}</span>
                  </td>
                  <td className="p-2 text-right text-[#22D1C3] font-black">{o.count}</td>
                  <td className="p-2 text-right text-[#a8b4cf]">{(o.area / 1000).toFixed(1)} km²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <TerritoriesClient />
      </Card>
    </>
  );
}

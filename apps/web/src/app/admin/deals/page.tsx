import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Table, Tr, Td, Badge, Stat } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const sb = await createClient();

  const { data: deals } = await sb
    .from("shop_deals")
    .select("id, shop_id, title, xp_cost, max_redemptions, redemption_count, active_until, active, created_at, local_businesses(name, city)")
    .order("created_at", { ascending: false })
    .limit(200);

  const active = (deals ?? []).filter((d) => d.active && (!d.active_until || new Date(d.active_until) > new Date()));
  const expired = (deals ?? []).filter((d) => !d.active || (d.active_until && new Date(d.active_until) <= new Date()));
  const totalRedemptions = (deals ?? []).reduce((s, d) => s + (d.redemption_count ?? 0), 0);

  return (
    <>
      <PageTitle title="⚡ Deals" subtitle={`${deals?.length ?? 0} Deals insgesamt`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Aktiv" value={active.length} color="#4ade80" />
        <Stat label="Abgelaufen" value={expired.length} color="#8b8fa3" />
        <Stat label="Einlösungen gesamt" value={totalRedemptions} color="#FFD700" />
        <Stat label="Ø Einlösung" value={deals?.length ? (totalRedemptions / deals.length).toFixed(1) : "0"} color="#22D1C3" />
      </div>

      <Table headers={["Shop", "Deal", "XP", "Einlösungen", "Läuft ab", "Status"]}>
        {((deals ?? []) as unknown as Array<{ id: string; shop_id: string; title: string; xp_cost?: number; max_redemptions?: number; redemption_count?: number; active_until?: string; active?: boolean; local_businesses: { name?: string; city?: string } | { name?: string; city?: string }[] | null }>).map((d) => {
          const isActive = d.active && (!d.active_until || new Date(d.active_until) > new Date());
          const lb = Array.isArray(d.local_businesses) ? d.local_businesses[0] : d.local_businesses;
          return (
            <Tr key={d.id}>
              <Td>
                {lb?.name ? (
                  <Link href={`/admin/shops/${d.shop_id}`} className="text-white hover:text-[#22D1C3]">
                    <div className="font-bold">{lb.name}</div>
                    <div className="text-xs text-[#8b8fa3]">{lb.city ?? ""}</div>
                  </Link>
                ) : (
                  <span className="text-[#8b8fa3]">Shop gelöscht</span>
                )}
              </Td>
              <Td>{d.title}</Td>
              <Td>{d.xp_cost ?? 0}</Td>
              <Td>{d.redemption_count ?? 0}{d.max_redemptions ? ` / ${d.max_redemptions}` : ""}</Td>
              <Td>{d.active_until ? new Date(d.active_until).toLocaleDateString("de-DE") : "unbegrenzt"}</Td>
              <Td>{isActive ? <Badge tone="success">aktiv</Badge> : <Badge tone="neutral">inaktiv</Badge>}</Td>
            </Tr>
          );
        })}
      </Table>
    </>
  );
}

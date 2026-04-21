import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Stat } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function QrCodesAdminPage() {
  const sb = await createClient();

  const [totalRes, activeRes, scansRes] = await Promise.all([
    sb.from("qr_codes").select("id", { count: "exact", head: true }),
    sb.from("qr_codes").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("xp_transactions").select("id", { count: "exact", head: true }).eq("source", "qr_scan"),
  ]);

  const { data: codes } = await sb.from("qr_codes")
    .select("id, code, discount_percent, valid_from, valid_until, max_uses, used_count, active, created_at, business:business_id(id, name, city)")
    .order("used_count", { ascending: false })
    .limit(100);

  type Row = {
    id: string; code: string; discount_percent: number; valid_from: string; valid_until: string | null;
    max_uses: number | null; used_count: number; active: boolean; created_at: string;
    business: { id: string; name: string | null; city: string | null } | { id: string; name: string | null; city: string | null }[] | null;
  };
  const rows = (codes ?? []) as Row[];
  const topUsed = rows.slice(0, 20);

  return (
    <>
      <PageTitle title="📱 QR-Codes" subtitle="Rabatt-Codes der Partner-Shops + Scan-Statistiken" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="QR-Codes gesamt" value={totalRes.count ?? 0} color="#22D1C3" />
        <Stat label="Aktiv" value={activeRes.count ?? 0} color="#4ade80" />
        <Stat label="Scans gesamt (XP)" value={scansRes.count ?? 0} color="#FFD700" />
        <Stat label="Top-Scans (Code)" value={topUsed[0]?.used_count ?? 0} delta={topUsed[0]?.code ?? "—"} color="#FF6B4A" />
      </div>

      <Card>
        <h2 className="text-lg font-bold mb-3">Top-QR-Codes (nach Nutzung)</h2>
        <div className="overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] tracking-wider text-[#8B8FA3]">
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Shop</th>
                <th className="text-right p-2">Rabatt</th>
                <th className="text-right p-2">Genutzt</th>
                <th className="text-right p-2">Limit</th>
                <th className="text-left p-2">Gültig bis</th>
                <th className="text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {topUsed.map((r) => {
                const biz = Array.isArray(r.business) ? r.business[0] : r.business;
                const expired = r.valid_until ? new Date(r.valid_until).getTime() < Date.now() : false;
                const exhausted = r.max_uses !== null && r.used_count >= r.max_uses;
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="p-2 font-mono text-xs text-[#FFD700]">{r.code}</td>
                    <td className="p-2 text-white">{biz?.name ?? "—"} <span className="text-[#8B8FA3] text-xs">{biz?.city ?? ""}</span></td>
                    <td className="p-2 text-right font-black text-[#22D1C3]">{r.discount_percent}%</td>
                    <td className="p-2 text-right text-[#4ade80] font-black">{r.used_count}</td>
                    <td className="p-2 text-right text-[#a8b4cf]">{r.max_uses ?? "∞"}</td>
                    <td className="p-2 text-[#a8b4cf] text-xs">{r.valid_until ? new Date(r.valid_until).toLocaleDateString("de-DE") : "—"}</td>
                    <td className="p-2 text-center">
                      {!r.active ? <Badge c="#8B8FA3">INAKTIV</Badge>
                        : expired ? <Badge c="#FF2D78">ABGELAUFEN</Badge>
                        : exhausted ? <Badge c="#FF6B4A">ERSCHÖPFT</Badge>
                        : <Badge c="#4ade80">AKTIV</Badge>}
                    </td>
                  </tr>
                );
              })}
              {topUsed.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-[#8B8FA3] text-sm">Noch keine QR-Codes angelegt.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Badge({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black"
    style={{ background: `${c}22`, color: c, border: `1px solid ${c}66` }}>{children}</span>;
}

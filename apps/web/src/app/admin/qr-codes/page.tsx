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

  const DEMO_CODES: Row[] = [
    { id: "d1",  code: "KREUZBERG2024",   discount_percent: 20, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 90 * 86400_000).toISOString(), max_uses: 500, used_count: 287, active: true,  created_at: new Date(Date.now() - 30 * 86400_000).toISOString(), business: { id: "b1", name: "Café Luna",           city: "Berlin" } },
    { id: "d2",  code: "SPATI15",         discount_percent: 15, valid_from: new Date().toISOString(), valid_until: null, max_uses: null, used_count: 412, active: true,  created_at: new Date(Date.now() - 60 * 86400_000).toISOString(), business: { id: "b2", name: "Späti Bergmann",      city: "Berlin" } },
    { id: "d3",  code: "BAECKER10",       discount_percent: 10, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 30 * 86400_000).toISOString(), max_uses: 1000, used_count: 89, active: true,  created_at: new Date(Date.now() - 10 * 86400_000).toISOString(), business: { id: "b3", name: "Bäckerei Schlemmer",  city: "Berlin" } },
    { id: "d4",  code: "RUNNERSHOP25",    discount_percent: 25, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 14 * 86400_000).toISOString(), max_uses: 100, used_count: 52, active: true,  created_at: new Date(Date.now() - 7 * 86400_000).toISOString(), business: { id: "b4", name: "Lauf-Laden Mitte",    city: "Berlin" } },
    { id: "d5",  code: "PIZZA2GO",        discount_percent: 15, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() - 2 * 86400_000).toISOString(), max_uses: 200, used_count: 198, active: true,  created_at: new Date(Date.now() - 45 * 86400_000).toISOString(), business: { id: "b5", name: "Pizzeria Napoli",    city: "Hamburg" } },
    { id: "d6",  code: "YOGA30",          discount_percent: 30, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 60 * 86400_000).toISOString(), max_uses: 50, used_count: 50, active: true,   created_at: new Date(Date.now() - 20 * 86400_000).toISOString(), business: { id: "b6", name: "Flow Yoga Studio",  city: "München" } },
    { id: "d7",  code: "VONDELPARK5",     discount_percent:  5, valid_from: new Date().toISOString(), valid_until: null, max_uses: null, used_count: 234, active: true,  created_at: new Date(Date.now() - 90 * 86400_000).toISOString(), business: { id: "b7", name: "Vondelpark Kiosk",   city: "Amsterdam" } },
    { id: "d8",  code: "CAMDEN20",        discount_percent: 20, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 180 * 86400_000).toISOString(), max_uses: null, used_count: 167, active: true, created_at: new Date(Date.now() - 40 * 86400_000).toISOString(), business: { id: "b8", name: "Camden Running Co.",  city: "London" } },
    { id: "d9",  code: "TESTCODE",        discount_percent: 10, valid_from: new Date().toISOString(), valid_until: null, max_uses: null, used_count: 12, active: false, created_at: new Date(Date.now() - 120 * 86400_000).toISOString(), business: { id: "b9", name: "Test-Shop",           city: "Berlin" } },
    { id: "d10", code: "PRENZL15",        discount_percent: 15, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 45 * 86400_000).toISOString(), max_uses: 300, used_count: 141, active: true,  created_at: new Date(Date.now() - 25 * 86400_000).toISOString(), business: { id: "b10", name: "Frische Küche", city: "Berlin" } },
  ];

  const rows = (codes ?? []) as Row[];
  const isDemo = rows.length === 0;
  const displayRows = isDemo ? DEMO_CODES : rows;
  const topUsed = [...displayRows].sort((a, b) => b.used_count - a.used_count).slice(0, 20);

  const demoTotal = DEMO_CODES.length;
  const demoActive = DEMO_CODES.filter((c) => c.active).length;
  const demoScans = DEMO_CODES.reduce((s, c) => s + c.used_count, 0);

  return (
    <>
      <PageTitle title="📱 QR-Codes" subtitle="Rabatt-Codes der Partner-Shops + Scan-Statistiken" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="QR-Codes gesamt" value={isDemo ? demoTotal : (totalRes.count ?? 0)} color="#22D1C3" />
        <Stat label="Aktiv" value={isDemo ? demoActive : (activeRes.count ?? 0)} color="#4ade80" />
        <Stat label="Scans gesamt (XP)" value={isDemo ? demoScans : (scansRes.count ?? 0)} color="#FFD700" />
        <Stat label="Top-Scans (Code)" value={topUsed[0]?.used_count ?? 0} delta={topUsed[0]?.code ?? "—"} color="#FF6B4A" />
      </div>

      {isDemo && (
        <div className="mb-4 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — noch keine QR-Codes in der DB.</span>
        </div>
      )}

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

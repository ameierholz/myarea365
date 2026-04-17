import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Stat, Badge } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const sb = await createClient();
  const { data: flags } = await sb.from("feature_flags").select("*").eq("key", "maintenance_mode").maybeSingle();
  const maintenance = !!flags?.enabled;

  const envChecks = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon", ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Service Role", ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "NEXT_PUBLIC_MAPBOX_TOKEN", label: "Mapbox Token", ok: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN },
    { key: "RESEND_API_KEY", label: "Resend API", ok: !!process.env.RESEND_API_KEY },
  ];

  const [{ count: totalUsers }, { count: totalWalks }, { count: totalTerritories }] = await Promise.all([
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("walks").select("id", { count: "exact", head: true }),
    sb.from("territories").select("id", { count: "exact", head: true }),
  ]);

  return (
    <>
      <PageTitle title="⚙️ System" subtitle="Environment, Health, Wartung" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Users" value={totalUsers ?? 0} />
        <Stat label="Walks" value={totalWalks ?? 0} color="#22D1C3" />
        <Stat label="Territories" value={totalTerritories ?? 0} color="#FFD700" />
        <Stat label="Wartungsmodus" value={maintenance ? "AN" : "AUS"} color={maintenance ? "#FF2D78" : "#4ade80"} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Environment-Variables</h2>
          <div className="space-y-2">
            {envChecks.map((c) => (
              <div key={c.key} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 text-sm">
                <div>
                  <div className="text-white">{c.label}</div>
                  <code className="text-[11px] text-[#8b8fa3]">{c.key}</code>
                </div>
                <Badge tone={c.ok ? "success" : "danger"}>{c.ok ? "✓ gesetzt" : "✗ fehlt"}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Build-Info</h2>
          <dl className="text-sm space-y-2">
            <Row label="Node">{process.version}</Row>
            <Row label="Plattform">{process.platform}</Row>
            <Row label="Umgebung">{process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "?"}</Row>
            <Row label="Region">{process.env.VERCEL_REGION ?? "local"}</Row>
            <Row label="Commit">{process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "?"}</Row>
          </dl>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#8b8fa3]">{label}</dt><dd className="text-white text-right">{children}</dd></div>;
}

import { createClient } from "@/lib/supabase/server";
import { Stat, PageTitle, Card, Badge } from "./_components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const sb = await createClient();

  const [
    { count: totalUsers },
    { count: activeToday },
    { count: signupsWeek },
    { count: crewsCount },
    { count: shopsCount },
    { count: openReports },
    { count: pendingLeads },
    { data: recent },
  ] = await Promise.all([
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("users").select("id", { count: "exact", head: true }).gte("last_seen_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    sb.from("users").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    sb.from("groups").select("id", { count: "exact", head: true }),
    sb.from("local_businesses").select("id", { count: "exact", head: true }),
    sb.from("moderation_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("sales_leads").select("id", { count: "exact", head: true }).in("status", ["new", "contacted"]),
    sb.from("admin_audit_log").select("action, target_type, target_id, created_at, actor_role").order("created_at", { ascending: false }).limit(10),
  ]);

  const { data: emailStats } = await sb
    .from("email_events")
    .select("status")
    .gte("sent_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  const emailsSent = emailStats?.filter((e) => e.status === "sent").length ?? 0;
  const emailsBounced = emailStats?.filter((e) => e.status === "bounced").length ?? 0;

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Übersicht der wichtigsten KPIs" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Runner gesamt" value={totalUsers ?? 0} />
        <Stat label="Aktiv (24h)" value={activeToday ?? 0} color="#4ade80" />
        <Stat label="Neuanmeldungen (7d)" value={signupsWeek ?? 0} color="#FFD700" />
        <Stat label="Crews" value={crewsCount ?? 0} color="#a855f7" />
        <Stat label="Shops" value={shopsCount ?? 0} color="#FF6B4A" />
        <Stat label="Offene Meldungen" value={openReports ?? 0} color="#FF2D78" />
        <Stat label="Sales Leads" value={pendingLeads ?? 0} color="#22D1C3" />
        <Stat label="E-Mails (7d)" value={emailsSent} delta={`${emailsBounced} Bounces`} color="#4ade80" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-bold mb-4">🔥 Quick-Actions</h2>
          <div className="space-y-2">
            <QuickAction href="/admin/marketing/campaigns/new" label="📧 Neue Kampagne erstellen" />
            <QuickAction href="/admin/sales/leads/new" label="💰 Sales-Lead hinzufügen" />
            <QuickAction href="/admin/moderation" label="⚖️ Meldungen prüfen" />
            <QuickAction href="/admin/runners" label="🏃 Runner-Suche" />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold mb-4">📋 Letzte Admin-Aktionen</h2>
          <div className="space-y-2">
            {(recent ?? []).length === 0 && <p className="text-sm text-[#8b8fa3]">Noch keine Aktionen geloggt.</p>}
            {(recent ?? []).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-white/5 py-1.5 last:border-0">
                <span className="text-[#dde3f5]">
                  <Badge tone="info">{r.actor_role ?? "?"}</Badge>{" "}
                  <span className="font-mono">{r.action}</span>
                  {r.target_type && <span className="text-[#8b8fa3]"> · {r.target_type}</span>}
                </span>
                <span className="text-[#8b8fa3]">{new Date(r.created_at).toLocaleString("de-DE")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors">
      <span>{label}</span>
      <span className="text-[#8b8fa3]">→</span>
    </a>
  );
}

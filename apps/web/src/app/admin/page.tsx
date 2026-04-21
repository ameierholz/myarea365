import { createClient } from "@/lib/supabase/server";
import { Stat, PageTitle, Card, Badge } from "./_components/ui";
import { EngagementCard, SignupTrendCard, RetentionCard, FunnelCard } from "./_components/engagement-widgets";

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
    sb.from("walks").select("user_id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
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

      {(totalUsers ?? 0) === 0 && (
        <div className="mb-4 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — Datenbank ist (fast) leer. Für alle Kennzahlen werden synthetische Werte angezeigt.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Runner gesamt" value={(totalUsers ?? 0) || 3_214} />
        <Stat label="Aktiv (letzte 24 Stunden)" value={(activeToday ?? 0) || 487} color="#4ade80" />
        <Stat label="Neuanmeldungen (letzte 7 Tage)" value={(signupsWeek ?? 0) || 142} color="#FFD700" />
        <Stat label="Crews" value={(crewsCount ?? 0) || 87} color="#a855f7" />
        <Stat label="Shops" value={(shopsCount ?? 0) || 34} color="#FF6B4A" />
        <Stat label="Offene Meldungen" value={(openReports ?? 0) || 5} color="#FF2D78" />
        <Stat label="Vertriebs-Interessenten" value={(pendingLeads ?? 0) || 12} color="#22D1C3" />
        <Stat label="E-Mails (letzte 7 Tage)" value={emailsSent || 1_843} delta={`${emailsBounced || 12} unzustellbar`} color="#4ade80" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <EngagementCard />
        <SignupTrendCard />
        <RetentionCard />
        <FunnelCard />
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
            {(recent ?? []).length === 0 && [
              { actor_role: "support", action: "user.ban", target_type: "user", created_at: new Date(Date.now() - 5 * 60_000).toISOString() },
              { actor_role: "admin",   action: "territory.delete", target_type: "territory", created_at: new Date(Date.now() - 18 * 60_000).toISOString() },
              { actor_role: "marketing", action: "broadcast.sent", target_type: "broadcast", created_at: new Date(Date.now() - 42 * 60_000).toISOString() },
              { actor_role: "sales",   action: "lead.won", target_type: "lead", created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
              { actor_role: "admin",   action: "user.role_change", target_type: "user", created_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
              { actor_role: "support", action: "ticket.resolved", target_type: "support_ticket", created_at: new Date(Date.now() - 6 * 3600_000).toISOString() },
            ].map((r, i) => (
              <div key={`demo-${i}`} className="flex items-center justify-between text-xs border-b border-white/5 py-1.5 last:border-0">
                <span className="text-[#dde3f5]">
                  <Badge tone="info">{r.actor_role}</Badge>{" "}
                  <span className="font-mono">{r.action}</span>
                  <span className="text-[#8b8fa3]"> · {r.target_type}</span>
                  <span className="text-[9px] ml-1 text-[#c084fc]">🤖</span>
                </span>
                <span className="text-[#8b8fa3]">{new Date(r.created_at).toLocaleString("de-DE")}</span>
              </div>
            ))}
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

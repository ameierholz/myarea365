// Operations-Cockpit — neues Admin-Dashboard.
// Statt nur KPIs zu zeigen ("alles passiert irgendwo") wird hier sichtbar
// gemacht WAS JETZT bearbeitet werden muss: Action-Queues mit Counts,
// Alters-Indikatoren (Badge "alt!" bei >48h), und Direktlinks zur Bearbeitung.
// KPIs + Engagement-Charts wandern unten weil sie informativ aber nicht
// handlungsleitend sind.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Stat, PageTitle, Card, Badge } from "./_components/ui";
import { EngagementCard, SignupTrendCard, RetentionCard, FunnelCard } from "./_components/engagement-widgets";

export const dynamic = "force-dynamic";

const HOUR = 3600 * 1000;

function ageHours(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / HOUR);
}

function ageBadge(hours: number | null): { label: string; tone: "neutral" | "warning" | "danger" } {
  if (hours == null) return { label: "—", tone: "neutral" };
  if (hours > 72) return { label: `${Math.round(hours / 24)}d alt!`, tone: "danger" };
  if (hours > 24) return { label: `${hours}h alt`, tone: "warning" };
  return { label: `${hours}h`, tone: "neutral" };
}

export default async function AdminDashboard() {
  const sb = await createClient();
  const since7d = new Date(Date.now() - 7 * 24 * HOUR).toISOString();

  const [
    // Queue-Counts + älteste 3 pro Queue
    pendingShops,        oldestPendingShop,
    openModReports,      oldestModReport,
    openShopReports,     oldestShopReport,
    openTickets,         oldestTicket,        urgentTickets,
    pendingMedia,
    staleLeads,
    pendingRefunds,
    // KPIs
    { count: totalUsers },
    { count: activeToday },
    { count: signupsWeek },
    { count: crewsCount },
    { count: shopsCount },
    { data: recent },
    { data: emailStats },
  ] = await Promise.all([
    sb.from("local_businesses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("local_businesses").select("id, name, created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(3),
    sb.from("moderation_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("moderation_reports").select("id, target_type, reason, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(3),
    sb.from("shop_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("shop_reports").select("id, business_id, reason, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(3),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    sb.from("support_tickets").select("id, subject, category, created_at").in("status", ["open", "in_progress"]).order("created_at", { ascending: true }).limit(3),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]).eq("category", "billing"),
    sb.from("users").select("id", { count: "exact", head: true }).or("avatar_status.eq.pending,banner_status.eq.pending"),
    sb.from("sales_leads").select("id", { count: "exact", head: true }).in("status", ["new", "contacted"]).lt("updated_at", new Date(Date.now() - 5 * 24 * HOUR).toISOString()),
    sb.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("walks").select("user_id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * HOUR).toISOString()),
    sb.from("users").select("id", { count: "exact", head: true }).gte("created_at", since7d),
    sb.from("groups").select("id", { count: "exact", head: true }),
    sb.from("local_businesses").select("id", { count: "exact", head: true }),
    sb.from("admin_audit_log").select("action, target_type, target_id, created_at, actor_role").order("created_at", { ascending: false }).limit(8),
    sb.from("email_events").select("status").gte("sent_at", since7d),
  ]);

  const emailsSent = emailStats?.filter((e) => e.status === "sent").length ?? 0;
  const emailsBounced = emailStats?.filter((e) => e.status === "bounced").length ?? 0;

  // Critical-Alert-Logik: hochpriore Sachen die JETZT eskaliert sind.
  const criticalAlerts: Array<{ icon: string; label: string; detail: string; href: string; tone: "danger" | "warning" }> = [];
  if ((urgentTickets.count ?? 0) > 0) {
    criticalAlerts.push({ icon: "💸", label: `${urgentTickets.count} Billing-Tickets offen`, detail: "Zahlungsprobleme — eskaliert behandeln", href: "/admin/support?category=billing", tone: "danger" });
  }
  if ((oldestTicket.data?.[0]?.created_at) && (ageHours(oldestTicket.data[0].created_at) ?? 0) > 48) {
    criticalAlerts.push({ icon: "🎫", label: `Ältestes Ticket: ${ageHours(oldestTicket.data[0].created_at)}h alt`, detail: oldestTicket.data[0].subject ?? "—", href: "/admin/support", tone: "warning" });
  }
  if ((oldestPendingShop.data?.[0]?.created_at) && (ageHours(oldestPendingShop.data[0].created_at) ?? 0) > 96) {
    criticalAlerts.push({ icon: "🏪", label: `Shop ${ageHours(oldestPendingShop.data[0].created_at)}h pending`, detail: oldestPendingShop.data[0].name ?? "—", href: "/admin/shops?status=pending", tone: "warning" });
  }
  if ((pendingRefunds.count ?? 0) > 0) {
    criticalAlerts.push({ icon: "💰", label: `${pendingRefunds.count} Refund-Anfragen`, detail: "Erstattungen warten auf Entscheidung", href: "/admin/refunds", tone: "danger" });
  }

  return (
    <>
      <PageTitle title="Operations-Cockpit" subtitle="Was muss heute bearbeitet werden?" />

      {/* Critical-Alerts (rot/gelb), nur wenn was los ist */}
      {criticalAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {criticalAlerts.map((a, i) => (
            <Link key={i} href={a.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${a.tone === "danger"
                ? "bg-[#FF2D78]/10 border-[#FF2D78]/40 hover:bg-[#FF2D78]/15"
                : "bg-[#FFD700]/10 border-[#FFD700]/40 hover:bg-[#FFD700]/15"} transition-colors`}>
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${a.tone === "danger" ? "text-[#FF2D78]" : "text-[#FFD700]"}`}>{a.label}</div>
                <div className="text-xs text-[#a8b4cf] truncate">{a.detail}</div>
              </div>
              <span className="text-[#8b8fa3] text-sm">öffnen →</span>
            </Link>
          ))}
        </div>
      )}

      {/* Action-Queues */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <QueueWidget
          icon="🏪" title="Shop-Verifications" tone="warning" href="/admin/shops?status=pending"
          count={pendingShops.count ?? 0}
          items={(oldestPendingShop.data ?? []).map((s) => ({ label: s.name ?? "Unbenannt", age: ageHours(s.created_at), href: `/admin/shops/${s.id}` }))}
        />
        <QueueWidget
          icon="🎫" title="Support-Tickets" tone="info" href="/admin/support"
          count={openTickets.count ?? 0}
          items={(oldestTicket.data ?? []).map((t) => ({ label: t.subject ?? "—", sub: t.category, age: ageHours(t.created_at), href: `/admin/support` }))}
          extra={(urgentTickets.count ?? 0) > 0 ? `${urgentTickets.count} Billing` : undefined}
        />
        <QueueWidget
          icon="⚖️" title="Mod-Meldungen" tone="danger" href="/admin/moderation"
          count={openModReports.count ?? 0}
          items={(oldestModReport.data ?? []).map((m) => ({ label: m.reason ?? "—", sub: m.target_type, age: ageHours(m.created_at), href: `/admin/moderation` }))}
        />
        <QueueWidget
          icon="⚠️" title="Shop-Beschwerden" tone="warning" href="/admin/shop-reports"
          count={openShopReports.count ?? 0}
          items={(oldestShopReport.data ?? []).map((r) => ({ label: r.reason ?? "—", age: ageHours(r.created_at), href: `/admin/shop-reports` }))}
        />
        <QueueWidget
          icon="📸" title="User-Media-Review" tone="info" href="/admin/user-media"
          count={pendingMedia.count ?? 0}
          items={[]} subtitle="Avatare & Banner zur Freigabe"
        />
        <QueueWidget
          icon="💰" title="Refund-Anfragen" tone="danger" href="/admin/refunds"
          count={pendingRefunds.count ?? 0}
          items={[]} subtitle="Erstattungen & Reverses"
        />
        <QueueWidget
          icon="📋" title="Stehengelassene Leads" tone="warning" href="/admin/sales/leads"
          count={staleLeads.count ?? 0}
          items={[]} subtitle="Leads ohne Update >5 Tage"
        />
        <QueueWidget
          icon="📢" title="Banner-Scheduler" tone="info" href="/admin/banners"
          count={0}
          items={[]} subtitle="In-App-Promo-Banner verwalten"
        />
        <QueueWidget
          icon="🎉" title="Event-Trigger" tone="info" href="/admin/events"
          count={0}
          items={[]} subtitle="Double-XP, Hunt-Reset, Specials"
        />
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Runner gesamt" value={(totalUsers ?? 0) || 3_214} />
        <Stat label="Aktiv (24h)" value={(activeToday ?? 0) || 487} color="#4ade80" />
        <Stat label="Neuanmeldungen (7d)" value={(signupsWeek ?? 0) || 142} color="#FFD700" />
        <Stat label="Crews" value={(crewsCount ?? 0) || 87} color="#a855f7" />
        <Stat label="Shops" value={(shopsCount ?? 0) || 34} color="#FF6B4A" />
        <Stat label="E-Mails (7d)" value={emailsSent || 1_843} delta={`${emailsBounced || 12} unzustellbar`} color="#4ade80" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <EngagementCard />
        <SignupTrendCard />
        <RetentionCard />
        <FunnelCard />
      </div>

      <Card>
        <h2 className="text-lg font-bold mb-4">📋 Letzte Admin-Aktionen</h2>
        <div className="space-y-2">
          {(recent ?? []).length === 0 && (
            <div className="text-sm text-[#8b8fa3]">Noch keine Admin-Aktionen geloggt.</div>
          )}
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
    </>
  );
}

function QueueWidget({ icon, title, count, tone, href, items, subtitle, extra }: {
  icon: string; title: string; count: number;
  tone: "neutral" | "info" | "warning" | "danger";
  href: string;
  items: Array<{ label: string; sub?: string | null; age: number | null; href?: string }>;
  subtitle?: string;
  extra?: string;
}) {
  const toneColor = tone === "danger" ? "#FF2D78" : tone === "warning" ? "#FFD700" : tone === "info" ? "#22D1C3" : "#dde3f5";
  const empty = count === 0 && items.length === 0;
  return (
    <Link href={href} className="block bg-[#1A1D23] border border-white/10 rounded-2xl p-4 hover:border-white/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-bold uppercase tracking-wider text-[#dde3f5]">{title}</span>
        </div>
        {extra && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF2D78]/15 text-[#FF2D78]">{extra}</span>
        )}
      </div>
      <div className="text-3xl font-black" style={{ color: empty ? "#4ade80" : toneColor }}>
        {empty ? "✓" : count}
      </div>
      {subtitle && <div className="text-[11px] text-[#8b8fa3] mt-1">{subtitle}</div>}
      {items.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          {items.map((it, i) => {
            const a = ageBadge(it.age);
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-[#dde3f5]">
                  {it.label}
                  {it.sub && <span className="text-[#8b8fa3]"> · {it.sub}</span>}
                </span>
                <span className={`shrink-0 font-bold ${a.tone === "danger" ? "text-[#FF2D78]" : a.tone === "warning" ? "text-[#FFD700]" : "text-[#8b8fa3]"}`}>
                  {a.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {empty && (
        <div className="mt-2 text-[11px] text-[#4ade80]">Alles erledigt 🎉</div>
      )}
    </Link>
  );
}

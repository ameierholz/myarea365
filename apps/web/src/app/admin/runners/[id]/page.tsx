import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Stat } from "../../_components/ui";
import { RunnerActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function RunnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();

  const { data: user } = await sb.from("users").select("*").eq("id", id).maybeSingle();
  if (!user) return <div className="text-red-400">Runner nicht gefunden.</div>;

  const { data: walks } = await sb.from("walks").select("distance_m, duration_s, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20);
  const { data: achievementsList } = await sb.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", id);
  const { data: groupsList } = await sb.from("group_members").select("group_id, role, joined_at, groups(name)").eq("user_id", id);

  // Cross-Entity-Counts für die Related-Activity-Karte
  const [
    { count: ticketsCount },
    { count: modReportsAgainstCount },
    { count: refundsCount },
    { count: awardsCount },
    warningLevelRes,
    ownedShopsRes,
  ] = await Promise.all([
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("moderation_reports").select("id", { count: "exact", head: true }).eq("target_type", "user").eq("target_id", id),
    sb.from("refund_requests").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("xp_awards").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.rpc("get_active_warning_level", { p_user_id: id }),
    sb.from("local_businesses").select("id, name, status").eq("owner_id", id).limit(5),
  ]);
  const warningLevel = (warningLevelRes?.data ?? null) as string | null;
  const ownedShops = (ownedShopsRes?.data ?? []) as Array<{ id: string; name: string; status: string }>;

  return (
    <>
      <div className="mb-4"><Link href="/admin/runners" className="text-sm text-[#22D1C3]">← Zur Übersicht</Link></div>
      <PageTitle title={user.display_name ?? user.username ?? "Runner"} subtitle={`@${user.username} · ${user.email_confirmed_at ? "verifiziert" : "unbestätigt"}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="km gesamt" value={((user.total_distance_m ?? 0) / 1000).toFixed(1)} />
        <Stat label="Läufe" value={user.total_walks ?? 0} color="#FFD700" />
        <Stat label="XP" value={(user.total_xp ?? 0).toLocaleString()} color="#a855f7" />
        <Stat label="Streak" value={user.streak_best ?? 0} color="#FF6B4A" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Stammdaten</h2>
          <dl className="text-sm space-y-2">
            <Row label="ID"><code className="text-[11px] text-[#8b8fa3]">{user.id}</code></Row>
            <Row label="Fraktion">{(user.faction === "syndicate" || user.faction === "gossenbund") ? "🗝️ Gossenbund" : (user.faction === "vanguard" || user.faction === "kronenwacht") ? "👑 Kronenwacht" : "—"}</Row>
            <Row label="Rolle"><Badge tone={user.role === "user" ? "neutral" : "info"}>{user.role}</Badge></Row>
            <Row label="Status">
              {user.is_banned && <Badge tone="danger">Gesperrt</Badge>}
              {user.shadow_banned && <Badge tone="warning">Shadow-Ban</Badge>}
              {!user.is_banned && !user.shadow_banned && <Badge tone="success">Aktiv</Badge>}
            </Row>
            <Row label="Registriert">{new Date(user.created_at).toLocaleString("de-DE")}</Row>
            <Row label="Newsletter">{user.email_notif_newsletter ? "✅" : "—"}</Row>
            <Row label="Monats-Stats">{user.email_notif_monthly ? "✅" : "—"}</Row>
          </dl>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Aktionen</h2>
          <RunnerActions
            userId={user.id}
            username={user.username}
            isBanned={!!user.is_banned}
            shadowBanned={!!user.shadow_banned}
            role={user.role ?? "user"}
            adminNotes={user.admin_notes ?? ""}
          />
        </Card>

        <Card className="md:col-span-2">
          <h2 className="font-bold mb-3">Letzte 20 Läufe</h2>
          {(walks ?? []).length === 0 && <p className="text-sm text-[#8b8fa3]">Noch keine Läufe.</p>}
          <div className="space-y-1">
            {(walks ?? []).map((w, i) => (
              <div key={i} className="flex justify-between text-xs border-b border-white/5 py-1.5 last:border-0">
                <span>{new Date(w.created_at).toLocaleString("de-DE")}</span>
                <span>{((w.distance_m ?? 0) / 1000).toFixed(2)} km · {Math.floor((w.duration_s ?? 0) / 60)} min</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Crews ({groupsList?.length ?? 0})</h2>
          {(groupsList ?? []).length === 0 && <p className="text-sm text-[#8b8fa3]">Kein Crew-Mitglied.</p>}
          <div className="space-y-1 text-sm">
            {(groupsList ?? []).map((g, i) => {
              const gr = g.groups as { name?: string } | null;
              return (
                <Link key={i} href={`/admin/crews/${g.group_id}`} className="flex justify-between border-b border-white/5 py-1 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded">
                  <span>{gr?.name ?? "?"}</span>
                  <Badge tone="neutral">{g.role}</Badge>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <h2 className="font-bold mb-3">🔗 Verbundene Aktivität</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <CrossLink href={`/admin/support?user=${id}`} icon="🎫" label="Support-Tickets" count={ticketsCount ?? 0} />
            <CrossLink href={`/admin/moderation?target=${id}`} icon="⚖️" label="Mod-Reports gegen User" count={modReportsAgainstCount ?? 0} />
            <CrossLink href={`/admin/refunds?user=${id}`} icon="💰" label="Refund-Anfragen" count={refundsCount ?? 0} />
            <CrossLink href={`/admin/runners/${id}/award`} icon="👑" label="XP/Crown-Awards" count={awardsCount ?? 0} action />
            <CrossLink href={`/admin/runners/${id}/warnings`} icon={warningLevel ? "🚨" : "✅"} label={warningLevel ? `Warning: ${warningLevel}` : "Keine Warnings"} count={null} action highlight={!!warningLevel} />
          </div>
          {ownedShops.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="text-[11px] uppercase tracking-wider text-[#8b8fa3] mb-2">Besitzt {ownedShops.length} Shop{ownedShops.length > 1 ? "s" : ""}</div>
              <div className="flex flex-wrap gap-2">
                {ownedShops.map((s) => (
                  <Link key={s.id} href={`/admin/shops/${s.id}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs">
                    <span>🏪</span><span>{s.name}</span><Badge tone={s.status === "approved" ? "success" : s.status === "pending" ? "warning" : "danger"}>{s.status}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Achievements ({achievementsList?.length ?? 0})</h2>
          {(achievementsList ?? []).length === 0 && <p className="text-sm text-[#8b8fa3]">Noch keine.</p>}
          <div className="flex flex-wrap gap-1.5">
            {(achievementsList ?? []).map((a, i) => <Badge key={i} tone="warning">{a.achievement_id}</Badge>)}
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-[#8b8fa3]">{label}</dt>
      <dd className="text-white text-right">{children}</dd>
    </div>
  );
}

function CrossLink({ href, icon, label, count, action, highlight }: {
  href: string; icon: string; label: string; count: number | null; action?: boolean; highlight?: boolean;
}) {
  return (
    <Link href={href} className={`flex flex-col gap-1 p-3 rounded-xl border ${highlight ? "bg-[#FF2D78]/10 border-[#FF2D78]/40" : "bg-white/5 border-white/10 hover:bg-white/10"} transition-colors`}>
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#8b8fa3]">{label}</div>
      {count !== null && <div className="text-xl font-black text-white">{count}</div>}
      {action && <div className="text-[10px] text-[#22D1C3]">öffnen →</div>}
    </Link>
  );
}

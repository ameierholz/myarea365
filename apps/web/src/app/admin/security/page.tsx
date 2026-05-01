import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Table, Tr, Td, Stat } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireAdmin();
  const sb = await createClient();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7d  = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: recentLogins },
    { data: recentFailures },
    { count: failures24h },
    { count: success24h },
    { data: staffUsers },
  ] = await Promise.all([
    sb.from("admin_login_attempts").select("id, email, ip_address, user_agent, success, created_at, user_id").gte("created_at", since7d).order("created_at", { ascending: false }).limit(50),
    sb.from("admin_login_attempts").select("id, email, ip_address, failure_reason, created_at").eq("success", false).gte("created_at", since7d).order("created_at", { ascending: false }).limit(20),
    sb.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("success", false).gte("created_at", since24h),
    sb.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("success", true).gte("created_at", since24h),
    sb.from("users").select("id, email, username, role, last_login_at").in("role", ["support", "marketing", "sales", "admin", "super_admin"]).order("role"),
  ]);

  // Brute-Force-Detection: IPs mit >5 Failures in 24h
  const ipFailures = new Map<string, number>();
  for (const f of recentFailures ?? []) {
    if (!f.ip_address) continue;
    ipFailures.set(f.ip_address, (ipFailures.get(f.ip_address) ?? 0) + 1);
  }
  const suspiciousIps = [...ipFailures.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageTitle title="🔐 Security Center" subtitle="Admin-Logins, fehlgeschlagene Versuche, Staff-Übersicht" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Logins (24h)" value={success24h ?? 0} color="#4ade80" />
        <Stat label="Fehlversuche (24h)" value={failures24h ?? 0} color={(failures24h ?? 0) > 5 ? "#FF2D78" : "#FFD700"} />
        <Stat label="Verdächtige IPs (7d)" value={suspiciousIps.length} color={suspiciousIps.length > 0 ? "#FF2D78" : "#4ade80"} />
        <Stat label="Staff-Konten" value={staffUsers?.length ?? 0} color="#22D1C3" />
      </div>

      {suspiciousIps.length > 0 && (
        <Card className="mb-6 border-[#FF2D78]/40 bg-[#FF2D78]/10">
          <h2 className="font-bold mb-3 text-[#FF2D78]">🚨 Verdächtige IPs (≥3 Fehlversuche)</h2>
          <div className="space-y-1.5">
            {suspiciousIps.map(([ip, count]) => (
              <div key={ip} className="flex justify-between text-sm">
                <code className="font-mono text-[#dde3f5]">{ip}</code>
                <Badge tone="danger">{count} Versuche</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="font-bold mb-3">📋 Letzte Admin-Logins (50)</h2>
          <div className="max-h-[500px] overflow-y-auto">
            <Table headers={["E-Mail", "IP", "Status", "Zeit"]}>
              {(recentLogins ?? []).map((l) => (
                <Tr key={l.id}>
                  <Td className="text-xs">{l.email}</Td>
                  <Td className="text-[10px] font-mono">{l.ip_address ?? "—"}</Td>
                  <Td><Badge tone={l.success ? "success" : "danger"}>{l.success ? "OK" : "fail"}</Badge></Td>
                  <Td className="text-[11px] text-[#8b8fa3]">{new Date(l.created_at).toLocaleString("de-DE")}</Td>
                </Tr>
              ))}
            </Table>
            {(recentLogins ?? []).length === 0 && (
              <div className="text-sm text-[#8b8fa3] p-4">Noch keine Login-Logs erfasst (das Tracking aktiviert sich beim nächsten Admin-Login).</div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">👤 Staff-Konten</h2>
          <Table headers={["User", "Rolle", "Letzter Login"]}>
            {(staffUsers ?? []).map((u) => (
              <Tr key={u.id}>
                <Td className="text-xs">@{u.username} <span className="text-[#8b8fa3]">{u.email}</span></Td>
                <Td><Badge tone={u.role === "super_admin" || u.role === "admin" ? "danger" : "info"}>{u.role}</Badge></Td>
                <Td className="text-[11px] text-[#8b8fa3]">{u.last_login_at ? new Date(u.last_login_at).toLocaleString("de-DE") : "nie"}</Td>
              </Tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card className="border-[#FFD700]/40 bg-[#FFD700]/5">
        <h2 className="font-bold mb-2">💡 2FA-Empfehlung</h2>
        <p className="text-sm text-[#dde3f5]">
          Aktiviere für alle Admin-Konten Multi-Faktor-Auth via Supabase Dashboard → Authentication → Providers → MFA.
          Aktuell loggen sich Admins nur via Passwort + Magic-Link ein.
        </p>
      </Card>
    </>
  );
}

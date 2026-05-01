import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge } from "../../../_components/ui";
import { WarningsClient } from "./warnings-client";

export const dynamic = "force-dynamic";

export default async function RunnerWarningsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sb = await createClient();
  const { data: user } = await sb.from("users").select("id, username, display_name").eq("id", id).maybeSingle();
  if (!user) return <div className="text-red-400">Runner nicht gefunden.</div>;
  const { data: rows } = await sb.from("user_warnings")
    .select("id, level, reason, issued_by, expires_at, active, created_at, issuer:users!user_warnings_issued_by_fkey(username)")
    .eq("user_id", id).order("created_at", { ascending: false });
  type RawRow = { id: string; level: string; reason: string; issued_by: string; expires_at: string | null; active: boolean; created_at: string; issuer: { username: string | null } | { username: string | null }[] | null };
  const flat = ((rows ?? []) as RawRow[]).map((r) => ({ ...r, issuer: Array.isArray(r.issuer) ? r.issuer[0] : r.issuer }));
  const activeBans = flat.filter((r) => r.active && r.level !== "warning" && (!r.expires_at || new Date(r.expires_at) > new Date()));
  return (
    <>
      <div className="mb-4"><Link href={`/admin/runners/${id}`} className="text-sm text-[#22D1C3]">← Zurück zum Runner</Link></div>
      <PageTitle title={`🚨 Warnings & Eskalation · ${user.display_name ?? user.username}`} subtitle="Progressive Enforcement: Warning → 24h-Timeout → 7d-Timeout → Perma-Ban" />
      {activeBans.length > 0 && (
        <Card className="mb-4 border-[#FF2D78]/40 bg-[#FF2D78]/10">
          <div className="text-sm font-bold text-[#FF2D78]">Aktive Sperre: {activeBans[0].level}</div>
          <div className="text-xs text-[#dde3f5] mt-1">{activeBans[0].reason}</div>
          {activeBans[0].expires_at && <div className="text-[11px] text-[#a8b4cf] mt-1">Endet: {new Date(activeBans[0].expires_at).toLocaleString("de-DE")}</div>}
        </Card>
      )}
      <WarningsClient userId={id} initial={flat} />
    </>
  );
}

export type WarningRow = {
  id: string; level: "warning" | "timeout_24h" | "timeout_7d" | "permanent_ban";
  reason: string; issued_by: string; expires_at: string | null;
  active: boolean; created_at: string;
  issuer: { username: string | null } | null;
};

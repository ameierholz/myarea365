import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge } from "../../../_components/ui";
import { AwardForm } from "./award-form";

export const dynamic = "force-dynamic";

export default async function RunnerAwardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sb = await createClient();
  const { data: user } = await sb.from("users").select("id, username, display_name, total_xp").eq("id", id).maybeSingle();
  if (!user) return <div className="text-red-400">Runner nicht gefunden.</div>;

  const { data: history } = await sb.from("xp_awards")
    .select("xp_delta, crown_delta, reason, category, created_at, awarded_by, awarded_by_user:users!xp_awards_awarded_by_fkey(username)")
    .eq("user_id", id).order("created_at", { ascending: false }).limit(20);

  return (
    <>
      <div className="mb-4"><Link href={`/admin/runners/${id}`} className="text-sm text-[#22D1C3]">← Zurück zum Runner</Link></div>
      <PageTitle title={`👑 XP/Crown-Award · ${user.display_name ?? user.username}`} subtitle={`Aktuell ${(user.total_xp ?? 0).toLocaleString()} XP`} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Neue Vergabe</h2>
          <AwardForm userId={id} />
        </Card>
        <Card>
          <h2 className="font-bold mb-3">Vergabe-Historie ({history?.length ?? 0})</h2>
          {(history ?? []).length === 0 && <p className="text-sm text-[#8b8fa3]">Noch keine Awards vergeben.</p>}
          <div className="space-y-2">
            {(history ?? []).map((h, i) => {
              const by = (h.awarded_by_user as { username?: string } | null)?.username ?? "?";
              return (
                <div key={i} className="text-xs border-b border-white/5 py-2 last:border-0">
                  <div className="flex justify-between">
                    <div>
                      {h.xp_delta !== 0 && <Badge tone={h.xp_delta > 0 ? "success" : "danger"}>{h.xp_delta > 0 ? "+" : ""}{h.xp_delta} XP</Badge>}
                      {h.crown_delta !== 0 && <span className="ml-1"><Badge tone="warning">{h.crown_delta > 0 ? "+" : ""}{h.crown_delta} 👑</Badge></span>}
                      <span className="ml-2 text-[#8b8fa3]">{h.category}</span>
                    </div>
                    <span className="text-[#8b8fa3]">{new Date(h.created_at).toLocaleString("de-DE")}</span>
                  </div>
                  <div className="text-[#dde3f5] mt-1">{h.reason}</div>
                  <div className="text-[10px] text-[#8b8fa3] mt-0.5">durch @{by}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

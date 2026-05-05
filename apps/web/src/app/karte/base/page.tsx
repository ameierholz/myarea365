import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BaseClient } from "./base-client";

export const dynamic = "force-dynamic";

export default async function BasePage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/karte/base");

  const { data: profile, error: profileErr } = await sb
    .from("users")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileErr) console.error("[/karte/base] profile error:", profileErr);

  // Base-Level (für Badge auf Avatar)
  const { data: baseRow } = await sb
    .from("bases")
    .select("level, plz")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // Aktive Bau- + Forschungs-Queues für Action-Tile-Badges (Counts)
  // Tabellen-Namen tolerant: kann je nach Migration variieren
  let queueCount = 0;
  let researchCount = 0;
  try {
    const r = await sb.from("research_queue").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
    researchCount = r.count ?? 0;
  } catch { /* table may not exist */ }

  let crew: { id: string; name: string; tag: string | null; color: string | null; role: string } | null = null;
  if (profile?.current_crew_id) {
    const [{ data: c }, { data: m }] = await Promise.all([
      sb.from("crews").select("*").eq("id", profile.current_crew_id).maybeSingle(),
      sb
        .from("crew_members")
        .select("role")
        .eq("crew_id", profile.current_crew_id)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
    ]);
    if (c) {
      const cc = c as { id: string; name: string; tag?: string | null; color?: string | null };
      crew = {
        id: cc.id,
        name: cc.name,
        tag: cc.tag ?? null,
        color: cc.color ?? null,
        role: ((m as { role?: string } | null)?.role) ?? "member",
      };
    }
  }

  const { count: achievementsCount } = await sb
    .from("user_achievements")
    .select("achievement_id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  return (
    <BaseClient
      profile={profile as Record<string, unknown> | null}
      crew={crew}
      achievementsCount={achievementsCount ?? 0}
      base={baseRow as { level?: number; plz?: string } | null}
      queueCount={queueCount}
      researchCount={researchCount}
    />
  );
}

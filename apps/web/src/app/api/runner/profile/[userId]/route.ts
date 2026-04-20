import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const sb = await createClient();

  const [userRes, guardianRes, collectionCountRes, totalArchetypesRes, territoryRes] = await Promise.all([
    sb.from("users").select("username, display_name, faction, team_color, supporter_tier, xp, level, total_distance_m, total_walks, total_calories, longest_run_m, current_crew_id").eq("id", userId).maybeSingle(),
    sb.from("user_guardians")
      .select("id, custom_name, level, xp, wins, losses, talent_points_available, archetype:archetype_id(id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd, ability_id, ability_name, ability_desc, lore, image_url, video_url)")
      .eq("user_id", userId).eq("is_active", true).maybeSingle(),
    sb.from("user_guardians").select("id", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("guardian_archetypes").select("id", { count: "exact", head: true }),
    sb.from("user_territories").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (!userRes.data) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const u = userRes.data as {
    username: string | null; display_name: string | null; faction: string | null;
    team_color: string | null; supporter_tier: string | null;
    xp: number; level: number | null;
    total_distance_m: number | null; total_walks: number | null;
    total_calories: number | null; longest_run_m: number | null;
    current_crew_id: string | null;
  };

  let crew: { name: string; color: string | null; role: string | null } | null = null;
  if (u.current_crew_id) {
    const { data: c } = await sb.from("crews").select("name, color").eq("id", u.current_crew_id).maybeSingle<{ name: string; color: string | null }>();
    if (c) crew = { name: c.name, color: c.color, role: null };
  }

  return NextResponse.json({
    username: u.username,
    display_name: u.display_name,
    faction: u.faction,
    team_color: u.team_color,
    supporter_tier: u.supporter_tier,
    xp: u.xp ?? 0,
    level: u.level,
    total_distance_m: u.total_distance_m ?? 0,
    total_walks: u.total_walks ?? 0,
    total_calories: u.total_calories ?? 0,
    longest_run_m: u.longest_run_m ?? 0,
    territory_count: territoryRes.count ?? 0,
    crew,
    active_guardian: guardianRes.data ?? null,
    collection_size: collectionCountRes.count ?? 0,
    collection_total: totalArchetypesRes.count ?? 0,
  });
}

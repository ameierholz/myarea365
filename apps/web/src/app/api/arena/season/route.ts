import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/season
 * Liefert die aktuelle Saison + ob der eingeloggte User schon einen Saison-Wächter hat.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const { data: season } = await sb.from("arena_seasons")
    .select("id, number, name, starts_at, ends_at, status")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return NextResponse.json({ ok: true, season: null, seasonal_guardian: null, eternal_guardian: null });
  }

  const [seasonalRes, eternalRes] = await Promise.all([
    sb.from("user_guardians")
      .select("id, archetype_id, level, xp, wins, losses, current_hp_pct, guardian_archetypes!inner(name, emoji, rarity, guardian_type)")
      .eq("user_id", auth.user.id)
      .eq("kind", "seasonal")
      .eq("season_id", (season as { id: string }).id)
      .maybeSingle(),
    sb.from("user_guardians")
      .select("id, archetype_id, level, wins, losses, guardian_archetypes!inner(name, emoji, rarity)")
      .eq("user_id", auth.user.id)
      .eq("kind", "eternal")
      .maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    season,
    seasonal_guardian: seasonalRes.data ?? null,
    eternal_guardian:  eternalRes.data  ?? null,
    needs_pick: !seasonalRes.data,
  });
}

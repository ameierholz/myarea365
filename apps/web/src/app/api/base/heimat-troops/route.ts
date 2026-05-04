import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/base/heimat-troops
 *   Vereinfachter Endpoint für die Heimat-Karte-Modals (Legion/Multi/Hide):
 *   verheiratet user_troops mit troops_catalog und liefert flachen
 *   Truppen-Bestand + aktive Wächter + March-Caps in einem Call.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [troopsRes, catalogRes, guardiansRes, capsRes] = await Promise.all([
    sb.from("user_troops").select("troop_id, count").eq("user_id", user.id).gt("count", 0),
    sb.from("troops_catalog").select("id, name, tier"),
    sb.from("user_guardians")
      .select("id, level, archetype:guardian_archetypes(name)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(20),
    sb.rpc("get_march_caps", { p_user_id: user.id }),
  ]);

  type CatRow = { id: string; name: string; tier: number };
  const catMap = new Map<string, CatRow>(((catalogRes.data ?? []) as CatRow[]).map((c) => [c.id, c]));

  type TroopRow = { troop_id: string; count: number };
  const troops = ((troopsRes.data ?? []) as TroopRow[])
    .map((t) => {
      const cat = catMap.get(t.troop_id);
      return { id: t.troop_id, name: cat?.name ?? t.troop_id, tier: cat?.tier ?? 1, have: t.count };
    })
    .sort((a, b) => a.tier - b.tier);

  type GRow = { id: string; level: number; archetype: { name: string } | { name: string }[] | null };
  const guardians = ((guardiansRes.data ?? []) as unknown as GRow[]).map((g) => {
    const arch = Array.isArray(g.archetype) ? g.archetype[0] : g.archetype;
    return { id: g.id, level: g.level, name: arch?.name ?? "Wächter" };
  });

  const caps = (Array.isArray(capsRes.data) ? capsRes.data[0] : null) as
    { march_capacity: number; march_queue: number; burg_level: number; guardian_bonus_pct: number } | null;

  return NextResponse.json({
    ok: true,
    troops,
    guardians,
    march_capacity: caps?.march_capacity ?? 60,
    march_queue: caps?.march_queue ?? 1,
    burg_level: caps?.burg_level ?? 1,
    guardian_bonus_pct: caps?.guardian_bonus_pct ?? 0,
  });
}

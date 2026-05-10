import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-Memory-Cache für troops_catalog (ändert sich praktisch nie).
// Pro Lambda-Instanz ein Cache, TTL 5min.
type CatRow = { id: string; name: string; tier: number; troop_class: string | null; emoji: string | null };
let _catalogCache: { data: CatRow[]; ts: number } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

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

  const now = Date.now();
  const catalogStale = !_catalogCache || (now - _catalogCache.ts) > CATALOG_TTL_MS;

  const [troopsRes, catalogRes, guardiansRes, capsRes] = await Promise.all([
    sb.from("user_troops").select("troop_id, count").eq("user_id", user.id).gt("count", 0),
    catalogStale
      ? sb.from("troops_catalog").select("id, name, tier, troop_class, emoji")
      : Promise.resolve({ data: _catalogCache!.data, error: null }),
    sb.from("user_guardians")
      .select("id, level, archetype:guardian_archetypes(id, name, emoji, guardian_type, role, rarity, image_url, ability_name, ability_desc)")
      .eq("user_id", user.id)
      .limit(50),
    sb.rpc("get_march_caps", { p_user_id: user.id }),
  ]);

  if (catalogStale && catalogRes.data) {
    _catalogCache = { data: catalogRes.data as CatRow[], ts: now };
  }
  const catMap = new Map<string, CatRow>(((catalogRes.data ?? []) as CatRow[]).map((c) => [c.id, c]));

  type TroopRow = { troop_id: string; count: number };
  const troops = ((troopsRes.data ?? []) as TroopRow[])
    .map((t) => {
      const cat = catMap.get(t.troop_id);
      return {
        id: t.troop_id,
        name: cat?.name ?? t.troop_id,
        tier: cat?.tier ?? 1,
        troop_class: cat?.troop_class ?? null,
        emoji: cat?.emoji ?? null,
        have: t.count,
      };
    })
    .sort((a, b) => a.tier - b.tier);

  type ArchRow = {
    id: string; name: string; emoji: string | null;
    guardian_type: string | null; role: string | null;
    rarity: string | null; image_url: string | null;
    ability_name: string | null; ability_desc: string | null;
  };
  type GRow = { id: string; level: number; archetype: ArchRow | ArchRow[] | null };
  const guardians = ((guardiansRes.data ?? []) as unknown as GRow[]).map((g) => {
    const arch = Array.isArray(g.archetype) ? g.archetype[0] : g.archetype;
    return {
      id: g.id,
      level: g.level,
      archetype_id: arch?.id ?? null,
      name: arch?.name ?? "Wächter",
      emoji: arch?.emoji ?? null,
      guardian_type: arch?.guardian_type ?? null,
      role: arch?.role ?? null,
      rarity: arch?.rarity ?? null,
      image_url: arch?.image_url ?? null,
      ability_name: arch?.ability_name ?? null,
      ability_desc: arch?.ability_desc ?? null,
    };
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

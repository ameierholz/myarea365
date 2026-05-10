import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/strongholds/active-sieges?lat=...&lng=...&radius_km=10
 *
 * Liefert Wegelager in der Umgebung, die GERADE belagert werden:
 *   - current_hp < total_hp (Schaden eingegangen)
 *   - irgendein Damage-Log innerhalb der letzten 60 Minuten
 *
 * Zweck: Live-Belagerungs-Banner auf der Heimat-Karte — Spieler sehen sofort
 * wenn in der Nähe was läuft und können beitreten/dagegen arbeiten.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const radiusKm = Math.min(50, parseFloat(url.searchParams.get("radius_km") ?? "10"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "missing_coords" }, { status: 400 });
  }

  // Sehr grobe BBox-Vorfilterung (~1° Lat = 111km, 1° Lng abhängig vom Cosinus)
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const { data: candidates, error } = await sb
    .from("strongholds")
    .select("id, lat, lng, level, total_hp, current_hp, npc_id, city_slug, defeated_at, spawned_at")
    .is("defeated_at", null)
    .gte("lat", lat - dLat).lte("lat", lat + dLat)
    .gte("lng", lng - dLng).lte("lng", lng + dLng)
    .lt("current_hp", 999999999); // platzhalter, gleich filtern wir auf <total_hp

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  type Sh = { id: string; lat: number; lng: number; level: number; total_hp: number; current_hp: number; npc_id: string | null; city_slug: string | null; defeated_at: string | null };
  const damaged = (candidates as Sh[] | null ?? []).filter((s) => s.current_hp < s.total_hp);
  if (damaged.length === 0) return NextResponse.json({ ok: true, sieges: [] });

  const ids = damaged.map((s) => s.id);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from("stronghold_damage_log")
    .select("stronghold_id, damage, recorded_at, crew_id")
    .in("stronghold_id", ids)
    .gte("recorded_at", since);

  type Dmg = { stronghold_id: string; damage: number; recorded_at: string; crew_id: string };
  const groupedByStronghold = new Map<string, { last_at: string; total_damage: number; attackers: Set<string> }>();
  for (const r of (recent as Dmg[] | null) ?? []) {
    const cur = groupedByStronghold.get(r.stronghold_id) ?? { last_at: r.recorded_at, total_damage: 0, attackers: new Set() };
    cur.total_damage += Number(r.damage ?? 0);
    if (r.recorded_at > cur.last_at) cur.last_at = r.recorded_at;
    if (r.crew_id) cur.attackers.add(r.crew_id);
    groupedByStronghold.set(r.stronghold_id, cur);
  }

  const sieges = damaged
    .filter((s) => groupedByStronghold.has(s.id))
    .map((s) => {
      const g = groupedByStronghold.get(s.id)!;
      const dist = haversineKm(lat, lng, s.lat, s.lng);
      return {
        stronghold_id: s.id,
        lat: s.lat, lng: s.lng,
        level: s.level,
        npc_id: s.npc_id,
        city_slug: s.city_slug,
        hp_pct: s.total_hp > 0 ? Math.round((s.current_hp / s.total_hp) * 100) : 0,
        last_damage_at: g.last_at,
        damage_last_hour: g.total_damage,
        attacker_crews: g.attackers.size,
        distance_km: Math.round(dist * 10) / 10,
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 10);

  return NextResponse.json({ ok: true, sieges });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const radius = parseFloat(url.searchParams.get("radius_km") ?? "15");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }
  // Defeated Strongholds, deren respawn_at abgelaufen ist, wiederbeleben.
  // Cheap (DB-seitiges Update auf indizierter Spalte) — sorgt dafür dass die
  // Welt ohne externe Cron-Jobs am Leben bleibt.
  await sb.rpc("respawn_due_strongholds");
  const { data, error } = await sb.rpc("get_nearby_strongholds", {
    p_lat: lat, p_lng: lng, p_radius_km: radius,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Strongholds sind nicht user-spezifisch → kurz Edge-Cache mit SWR.
  return NextResponse.json({ ok: true, strongholds: data ?? [] }, {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
  });
}

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolvePlzFromCoords, normalizeStreetName } from "@/lib/geo-plz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel-Cron: löst PLZ für street_segments auf, die noch keine haben.
 *
 * Strategie:
 *  1. Batch von bis zu 500 pending Segmenten holen
 *  2. Für alle Street-Names prüfen, ob sie bereits im street_plz_cache liegen
 *     → diese Segmente ohne Nominatim-Call sofort updaten
 *  3. Restliche Street-Names (bis zu 40 pro Durchlauf) per Nominatim auflösen,
 *     mit 1 s Delay zwischen Calls (Rate-Limit)
 *  4. Resolvte Street-Names in Cache schreiben, Segmente updaten
 *
 * Auth: Vercel sendet `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });
  }
  const sb = createAdminClient(url, key, { auth: { persistSession: false } });

  // 1) Pending Segmente holen
  const { data: pending } = await sb
    .from("street_segments")
    .select("id, street_name, geom")
    .is("plz", null)
    .order("created_at", { ascending: true })
    .limit(500);

  type PendingRow = { id: string; street_name: string | null; geom: Array<{ lat: number; lng: number }> | null };
  const rows = (pending ?? []) as PendingRow[];

  // Pro Street-Name eine Liste von Segment-IDs + ein Sample-Punkt fürs Geocoding
  const byStreetNorm = new Map<string, { segmentIds: string[]; sampleLat: number; sampleLng: number }>();
  for (const row of rows) {
    const norm = normalizeStreetName(row.street_name);
    if (!norm) continue;
    const first = Array.isArray(row.geom) && row.geom.length > 0 ? row.geom[0] : null;
    if (!first) continue;
    const entry = byStreetNorm.get(norm) ?? { segmentIds: [], sampleLat: first.lat, sampleLng: first.lng };
    entry.segmentIds.push(row.id);
    byStreetNorm.set(norm, entry);
  }

  // 2) Cache-Lookup für alle Street-Names auf einen Streich
  const plzByNorm = new Map<string, string>();
  if (byStreetNorm.size > 0) {
    const { data: cached } = await sb
      .from("street_plz_cache")
      .select("street_name_norm, plz")
      .in("street_name_norm", Array.from(byStreetNorm.keys()));
    for (const c of (cached ?? []) as Array<{ street_name_norm: string; plz: string }>) {
      plzByNorm.set(c.street_name_norm, c.plz);
    }
  }

  // 3) Unauflöste Street-Names via Nominatim (max. 40 pro Run)
  const unresolved = Array.from(byStreetNorm.keys()).filter((n) => !plzByNorm.has(n)).slice(0, 40);
  const newlyResolved: Array<{ street_name_norm: string; plz: string; sample_lat: number; sample_lng: number }> = [];

  for (let i = 0; i < unresolved.length; i++) {
    const norm = unresolved[i];
    const entry = byStreetNorm.get(norm);
    if (!entry) continue;
    const plz = await resolvePlzFromCoords(entry.sampleLat, entry.sampleLng);
    if (plz) {
      plzByNorm.set(norm, plz);
      newlyResolved.push({
        street_name_norm: norm,
        plz,
        sample_lat: entry.sampleLat,
        sample_lng: entry.sampleLng,
      });
    }
    // Rate-Limit: 1 Req/s (plus etwas Puffer)
    if (i < unresolved.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  // 4a) Cache erweitern
  if (newlyResolved.length > 0) {
    await sb.from("street_plz_cache").upsert(newlyResolved, { onConflict: "street_name_norm" });
  }

  // 4b) Segmente batch-updaten: alle mit derselben PLZ in einem Zug
  let segmentsUpdated = 0;
  const byPlz = new Map<string, string[]>();
  for (const [norm, entry] of byStreetNorm.entries()) {
    const plz = plzByNorm.get(norm);
    if (!plz) continue;
    const arr = byPlz.get(plz) ?? [];
    arr.push(...entry.segmentIds);
    byPlz.set(plz, arr);
  }
  for (const [plz, ids] of byPlz.entries()) {
    const { error, count } = await sb
      .from("street_segments")
      .update({ plz }, { count: "exact" })
      .in("id", ids);
    if (!error) segmentsUpdated += count ?? ids.length;
  }

  return NextResponse.json({
    ok: true,
    pending_total: rows.length,
    unique_streets: byStreetNorm.size,
    cache_hits: Array.from(plzByNorm.entries()).length - newlyResolved.length,
    nominatim_calls: unresolved.length,
    newly_resolved_streets: newlyResolved.length,
    segments_updated: segmentsUpdated,
  });
}

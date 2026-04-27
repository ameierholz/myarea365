import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAddressFromCoords } from "@/lib/geo-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/walks/backfill-addresses?batch=20
 *
 * Backfill für alte Walks: sucht bis zu N Walks ohne start_address und
 * reverse-geocodet ihre Endpunkte sequentiell (Nominatim 1 req/s).
 *
 * Gibt zurück: { processed, remaining }. Mehrfach aufrufen bis remaining=0.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Admin-Check: nur eigene Walks (Migration ist user-scoped via RPC)
  // Für vollständigen Backfill aller User → service-role wäre nötig; hier
  // bewusst auf den eingeloggten User begrenzt damit kein Missbrauch.

  const url = new URL(req.url);
  const batch = Math.max(1, Math.min(50, Number(url.searchParams.get("batch") ?? 20)));

  const { data: pending } = await sb
    .from("walks")
    .select("id")
    .eq("user_id", user.id)
    .is("start_address", null)
    .order("created_at", { ascending: false })
    .limit(batch);

  const ids = (pending ?? []).map((r: { id: string }) => r.id);
  let processed = 0;

  for (const walkId of ids) {
    try {
      const { data: ep } = await sb.rpc("get_walk_endpoints", { p_walk_id: walkId });
      if (!ep || !(ep as { ok?: boolean }).ok) continue;
      const e = ep as { start: [number, number]; end: [number, number] };

      const startAddr = await resolveAddressFromCoords(e.start[1], e.start[0]);
      await new Promise((r) => setTimeout(r, 1100));
      const endAddr = await resolveAddressFromCoords(e.end[1], e.end[0]);
      await new Promise((r) => setTimeout(r, 1100));

      if (startAddr || endAddr) {
        await sb.rpc("set_walk_addresses", { p_walk_id: walkId, p_start: startAddr, p_end: endAddr });
        processed += 1;
      }
    } catch { /* skip & next */ }
  }

  // Wieviele bleiben noch übrig?
  const { count: remaining } = await sb
    .from("walks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("start_address", null);

  return NextResponse.json({ processed, attempted: ids.length, remaining: remaining ?? 0 });
}

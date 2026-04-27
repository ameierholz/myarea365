import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAddressFromCoords } from "@/lib/geo-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/walk-record
 * Body: { walk_id: string }
 *
 * 1) Ruft RPC record_walk_resources → vergibt RSS + Tokens, schreibt Bonus-Log
 * 2) Holt Start-/End-Koordinaten aus walks.route, reverse-geocodet beide
 *    via Nominatim und speichert die Adressen am Walk.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { walk_id?: string };
  if (!body.walk_id) return NextResponse.json({ error: "missing_walk_id" }, { status: 400 });

  // 1) Drops + Tokens vergeben
  const { data: dropResult, error: dropErr } = await sb.rpc("record_walk_resources", { p_walk_id: body.walk_id });
  if (dropErr) return NextResponse.json({ error: dropErr.message }, { status: 500 });

  // 2) Adressen — best effort, blockiert die Antwort nicht bei Fehler
  try {
    const { data: ep } = await sb.rpc("get_walk_endpoints", { p_walk_id: body.walk_id });
    if (ep && (ep as { ok?: boolean }).ok) {
      const e = ep as { start: [number, number]; end: [number, number] };
      // Nominatim erlaubt 1 Req/s — sequentiell mit kurzem Delay.
      const startAddr = await resolveAddressFromCoords(e.start[1], e.start[0]);
      await new Promise((r) => setTimeout(r, 1100));
      const endAddr = await resolveAddressFromCoords(e.end[1], e.end[0]);
      if (startAddr || endAddr) {
        await sb.rpc("set_walk_addresses", { p_walk_id: body.walk_id, p_start: startAddr, p_end: endAddr });
      }
    }
  } catch { /* address resolve ist best-effort */ }

  return NextResponse.json(dropResult);
}

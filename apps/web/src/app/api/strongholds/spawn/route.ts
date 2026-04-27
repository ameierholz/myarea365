import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trigger Spawn für eine PLZ (manuell oder vom Cron). Auch reine "Refresh"-Aufrufe
// nach Login OK — RPC ist idempotent (bis zu 5 aktive Strongholds pro PLZ).
export async function POST(req: Request) {
  const sb = await createClient();
  const { plz, lat, lng } = await req.json() as { plz?: string; lat?: number; lng?: number };
  if (!plz || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  // Erst respawnen lassen, dann ggf. neue spawnen
  await sb.rpc("respawn_due_strongholds");
  const { data, error } = await sb.rpc("spawn_strongholds_for_plz", {
    p_plz: plz, p_center_lat: lat, p_center_lng: lng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, spawned: data ?? 0 });
}

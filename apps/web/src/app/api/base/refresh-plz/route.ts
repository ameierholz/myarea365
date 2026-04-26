import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/refresh-plz
 * Reverse-geocodes the current base lat/lng → PLZ via Nominatim.
 * Nutzbar, wenn eine Bestandsbase noch eine Default-PLZ hat.
 */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: base, error: bErr } = await sb
    .from("bases")
    .select("id, lat, lng, plz")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (!base) return NextResponse.json({ error: "no_base" }, { status: 404 });
  if (base.lat == null || base.lng == null) {
    return NextResponse.json({ error: "no_position" }, { status: 400 });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${base.lat}&lon=${base.lng}&zoom=14&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "myarea365.de (contact: a.meierholz@gmail.com)", "Accept-Language": "de" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return NextResponse.json({ error: "geocoding_failed" }, { status: 502 });
    const j = await r.json() as { address?: { postcode?: string } };
    const code = j.address?.postcode?.trim();
    if (!code) return NextResponse.json({ error: "no_postcode_for_location" }, { status: 404 });
    const { error: rpcErr } = await sb.rpc("set_base_plz", { p_plz: code });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, plz: code });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "geocoding_error" }, { status: 502 });
  }
}

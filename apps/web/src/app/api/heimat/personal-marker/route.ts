import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/heimat/personal-marker — Body: { lat, lng, category, label? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    lat?: number; lng?: number;
    category?: "allgemein" | "freunde" | "gegner";
    label?: string;
  };
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || !body.category) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!["allgemein", "freunde", "gegner"].includes(body.category)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  const { data, error } = await sb.from("user_map_markers").insert({
    user_id: user.id,
    lat: body.lat,
    lng: body.lng,
    category: body.category,
    label: body.label ?? null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, marker_id: data.id });
}

/** GET /api/heimat/personal-marker — eigene Markierungen */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data } = await sb.from("user_map_markers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ ok: true, markers: data ?? [] });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/hide — Truppen in Gebäude verstecken (Garrison). */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    target_kind: "base" | "crew_repeater" | "wegelager" | "mega_repeater";
    target_lat: number;
    target_lng: number;
    troops: Record<string, number>;
    target_id?: string | null;
    guardian_id?: string | null;
  };

  const { data, error } = await sb.rpc("hide_in_building", {
    p_target_kind: body.target_kind,
    p_target_lat: body.target_lat,
    p_target_lng: body.target_lng,
    p_troops: body.troops,
    p_target_id: body.target_id ?? null,
    p_guardian_id: body.guardian_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/base/hide?garrison_id=... — Truppen aus Garrison zurückholen. */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const garrisonId = url.searchParams.get("garrison_id");
  if (!garrisonId) return NextResponse.json({ error: "missing_garrison_id" }, { status: 400 });

  const { data, error } = await sb.rpc("unhide_from_building", { p_garrison_id: garrisonId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

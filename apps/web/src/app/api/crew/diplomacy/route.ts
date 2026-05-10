import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?crew_id=... — Diplomacy-Liste einer Crew */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const crewId = url.searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ ok: false, error: "missing_crew_id" }, { status: 400 });
  const { data, error } = await sb.rpc("list_crew_diplomacy", { p_crew_id: crewId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, diplomacy: data });
}

/** POST — { other_crew, status: "nap"|"allied"|"enemy", duration_hours? } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { other_crew?: string; status?: string; duration_hours?: number };
  if (!body.other_crew || !body.status) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  const { data, error } = await sb.rpc("set_crew_diplomacy", {
    p_other_crew: body.other_crew, p_status: body.status, p_duration_hours: body.duration_hours ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

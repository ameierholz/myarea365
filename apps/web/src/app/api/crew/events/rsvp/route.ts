import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/crew/events/rsvp  { event_id, status: "going"|"maybe"|"declined" } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { event_id?: string; status?: "going" | "maybe" | "declined" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.event_id || !body.status) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { error } = await sb.from("crew_event_rsvps").upsert({
    event_id: body.event_id,
    user_id: user.id,
    status: body.status,
  }, { onConflict: "event_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

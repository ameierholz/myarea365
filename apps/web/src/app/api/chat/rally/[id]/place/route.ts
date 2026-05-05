import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/rally/:id/place
 *  Liest Rally-Message, platziert Crew-Marker für aufrufenden User.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: msg, error: mErr } = await sb.from("chat_messages")
    .select("kind, attachments")
    .eq("id", id).maybeSingle();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!msg || msg.kind !== "rally") return NextResponse.json({ error: "not_rally" }, { status: 400 });

  const a = (msg.attachments ?? {}) as { lat?: number; lng?: number; action?: string; label?: string; urgent?: boolean };
  if (a.lat == null || a.lng == null || !a.action) return NextResponse.json({ error: "missing_coords" }, { status: 400 });

  const { data, error } = await sb.rpc("place_crew_marker", {
    p_lat: a.lat, p_lng: a.lng,
    p_action_kind: a.action,
    p_label: a.label ?? null,
    p_is_urgent: !!a.urgent,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, marker: data });
}

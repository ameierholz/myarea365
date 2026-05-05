import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/rally
 *  Body: { room_id, lat, lng, action, label?, urgent?, body? }
 *  Sendet Rally-Message + setzt Crew-Marker (place_crew_marker).
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const j = await req.json() as { room_id?: string; lat?: number; lng?: number; action?: string; label?: string; urgent?: boolean; body?: string };
  if (!j.room_id || j.lat == null || j.lng == null || !j.action) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // 1) Crew-Marker auf Map setzen
  const { data: markerRes, error: mErr } = await sb.rpc("place_crew_marker", {
    p_lat: j.lat,
    p_lng: j.lng,
    p_action_kind: j.action,
    p_label: j.label ?? null,
    p_is_urgent: j.urgent ?? false,
  });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // 2) Rally-Nachricht in Chat — Kind "rally" mit Coords als attachments
  const text = j.body ?? `📍 Rally: ${j.action.toUpperCase()}${j.label ? ` — ${j.label}` : ""}`;
  const { data: msgId, error: sErr } = await sb.rpc("chat_send_message", {
    p_room_id: j.room_id,
    p_body: text,
    p_attachments: { lat: j.lat, lng: j.lng, action: j.action, label: j.label ?? null, urgent: j.urgent ?? false },
    p_reply_to_id: null,
    p_kind: "rally",
  });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message_id: msgId, marker: markerRes });
}

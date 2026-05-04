import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/heimat/share-pin
 * Body: { lat, lng, label?, target: "crew" | "user", to_user_id? }
 *
 * Sendet einen Map-Pin als Inbox-Nachricht. Crew → an alle Crew-Mitglieder.
 * User → an einen einzelnen Empfänger.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    lat?: number; lng?: number; label?: string;
    target?: "crew" | "user"; to_user_id?: string;
  };
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || !body.target) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const title = body.label || `Pin geteilt`;
  const lat = body.lat.toFixed(5);
  const lng = body.lng.toFixed(5);
  const bodyText = `Map-Pin: ${lat}, ${lng}` + (body.label ? `\n${body.label}` : "");

  if (body.target === "crew") {
    const { data, error } = await sb.rpc("post_crew_message", {
      p_subcategory: "map_pin",
      p_title: title,
      p_body: bodyText,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, recipients: data });
  }

  if (body.target === "user" && body.to_user_id) {
    const { error } = await sb.rpc("send_personal_message", {
      p_to_user: body.to_user_id,
      p_title: title,
      p_body: bodyText,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_target" }, { status: 400 });
}

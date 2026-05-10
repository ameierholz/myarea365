import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crew/hierarchy — alle Hierarchie-Aktionen unter einem Endpoint.
 * Body: { action: "promote"|"kick"|"leave"|"transfer"|"disband", crew_id, ... }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    action?: string;
    crew_id?: string;
    user_id?: string;
    new_owner?: string;
    to_role?: string;
  };
  const action = body.action;
  if (!body.crew_id) return NextResponse.json({ ok: false, error: "missing_crew_id" }, { status: 400 });

  if (action === "promote") {
    if (!body.user_id || !body.to_role) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    const { data, error } = await sb.rpc("promote_crew_member", { p_crew_id: body.crew_id, p_user_id: body.user_id, p_to_role: body.to_role });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "kick") {
    if (!body.user_id) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });
    const { data, error } = await sb.rpc("kick_crew_member", { p_crew_id: body.crew_id, p_user_id: body.user_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "leave") {
    const { data, error } = await sb.rpc("leave_crew", { p_crew_id: body.crew_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "transfer") {
    if (!body.new_owner) return NextResponse.json({ ok: false, error: "missing_new_owner" }, { status: 400 });
    const { data, error } = await sb.rpc("transfer_crew_leadership", { p_crew_id: body.crew_id, p_new_owner: body.new_owner });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "disband") {
    const { data, error } = await sb.rpc("disband_crew", { p_crew_id: body.crew_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/messages?crew_id=...&limit=50 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const crewId = url.searchParams.get("crew_id");
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb.from("crew_messages")
    .select("id, user_id, body, reply_to, created_at, edited_at, deleted_at, user:user_id(username, display_name, avatar_url, team_color)")
    .eq("crew_id", crewId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

/** POST /api/crew/messages  { crew_id, body, reply_to? } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { crew_id?: string; body?: string; reply_to?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const text = (body.body ?? "").trim();
  if (!body.crew_id || text.length === 0) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (text.length > 600) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const { data, error } = await sb.from("crew_messages").insert({
    crew_id: body.crew_id,
    user_id: user.id,
    body: text,
    reply_to: body.reply_to ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}

/** DELETE /api/crew/messages?id=... (eigene Nachricht soft-deleten) */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await sb.from("crew_messages")
    .update({ deleted_at: new Date().toISOString(), body: "[gelöscht]" })
    .eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

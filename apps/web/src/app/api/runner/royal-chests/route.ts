import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/runner/royal-chests              → my chests + my titles
 * POST { action: "send", recipient, kind }   → Lord sendet Truhe
 * POST { action: "grant_title", recipient, title } → Lord verleiht Titel
 * POST { action: "claim", chest_id }         → Empfänger einlöst
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [chestsQ, titlesQ] = await Promise.all([
    sb.from("royal_chests").select("*").order("sent_at", { ascending: false }),
    sb.from("user_titles").select("*").eq("user_id", auth.user.id),
  ]);
  return NextResponse.json({ chests: chestsQ.data ?? [], titles: titlesQ.data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as
    { action?: string; recipient?: string; kind?: string; title?: string; chest_id?: string } | null;

  if (body?.action === "send" && body.recipient && body.kind) {
    const { data, error } = await sb.rpc("lord_send_royal_chest", { p_recipient: body.recipient, p_kind: body.kind });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, chest_id: data });
  }
  if (body?.action === "grant_title" && body.recipient && body.title) {
    const { data, error } = await sb.rpc("lord_grant_title", { p_recipient: body.recipient, p_title: body.title });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, title_id: data });
  }
  if (body?.action === "claim" && body.chest_id) {
    const { data, error } = await sb.rpc("claim_royal_chest", { p_chest_id: body.chest_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}

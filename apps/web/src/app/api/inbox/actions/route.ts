import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/actions
 * Body: { action: 'read'|'delete'|'star'|'claim'|'delete_all_read', ids?: string[], category?: string }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    action: "read" | "delete" | "star" | "claim" | "delete_all_read";
    ids?: string[];
    category?: string;
  };

  if (body.action === "read") {
    if (!body.ids?.length) return NextResponse.json({ error: "missing_ids" }, { status: 400 });
    const { data, error } = await sb.rpc("mark_inbox_read", { p_ids: body.ids });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: data });
  }

  if (body.action === "delete") {
    if (!body.ids?.length) return NextResponse.json({ error: "missing_ids" }, { status: 400 });
    const { data, error } = await sb.rpc("mark_inbox_deleted", { p_ids: body.ids });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: data });
  }

  if (body.action === "star") {
    if (!body.ids?.[0]) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const { data, error } = await sb.rpc("toggle_inbox_star", { p_id: body.ids[0] });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, starred: data });
  }

  if (body.action === "claim") {
    const { data, error } = await sb.rpc("claim_inbox_rewards", { p_ids: body.ids ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "delete_all_read") {
    const { data, error } = await sb.rpc("delete_all_read", { p_category: body.category ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: data });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

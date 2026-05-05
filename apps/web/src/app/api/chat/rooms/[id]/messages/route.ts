import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/chat/rooms/:id/messages?before=<created_at>&limit=50 — Liste lesen */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));

  let q = sb.from("chat_messages")
    .select(`
      id, room_id, user_id, kind, body, attachments, reply_to_id,
      edited_at, deleted_at, pinned_at, pinned_by, created_at,
      author:user_id(username, display_name, avatar_url, equipped_marker_id, equipped_marker_variant, equipped_base_ring_id),
      reactions:chat_reactions(emoji, user_id),
      poll:chat_polls(question, options, multi_choice, closes_at, closed_at,
        votes:chat_poll_votes(user_id, option_index))
    `)
    .eq("room_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Crew-Tags pro User-ID nachholen (separate Query, billig dank index)
  type Msg = {
    user_id: string | null;
    author: { username: string | null; display_name: string | null; avatar_url: string | null; equipped_marker_id?: string | null; equipped_marker_variant?: string | null; equipped_base_ring_id?: string | null; crew_tag?: string | null } | null;
    [k: string]: unknown;
  };
  const messages = ((data ?? []) as unknown as Msg[]);
  const userIds = Array.from(new Set(messages.map((m) => m.user_id).filter((u): u is string => !!u)));
  if (userIds.length > 0) {
    const { data: cms } = await sb.from("crew_members")
      .select("user_id, crews:crew_id(tag)")
      .in("user_id", userIds);
    const tagByUser = new Map<string, string | null>();
    for (const cm of (cms ?? []) as Array<{ user_id: string; crews: { tag: string | null } | { tag: string | null }[] | null }>) {
      const c = Array.isArray(cm.crews) ? cm.crews[0] : cm.crews;
      tagByUser.set(cm.user_id, c?.tag ?? null);
    }
    for (const m of messages) {
      if (m.user_id && m.author) {
        m.author.crew_tag = tagByUser.get(m.user_id) ?? null;
      }
    }
  }

  return NextResponse.json({ messages: messages.reverse() });
}

/** POST /api/chat/rooms/:id/messages — Nachricht senden */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json() as { body?: string; attachments?: unknown; reply_to_id?: string; kind?: string };

  const { data, error } = await sb.rpc("chat_send_message", {
    p_room_id: id,
    p_body: body.body ?? "",
    p_attachments: body.attachments ?? null,
    p_reply_to_id: body.reply_to_id ?? null,
    p_kind: body.kind ?? "text",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message_id: data });
}

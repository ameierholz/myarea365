import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/chat/rooms/:id/state — Body: { archive?, mute?, hide? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json() as { archive?: boolean; mute?: boolean; hide?: boolean };

  const { error } = await sb.rpc("chat_set_room_state", {
    p_room_id: id,
    p_archive: body.archive ?? null,
    p_mute: body.mute ?? null,
    p_hide: body.hide ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

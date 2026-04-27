import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/send
 * Body: { kind: 'personal'|'crew', to_user?: string, subcategory?: string, title: string, body: string }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    kind: "personal" | "crew";
    to_user?: string;
    subcategory?: string;
    title: string;
    body: string;
  };
  if (!body.title || !body.body) return NextResponse.json({ error: "missing_title_or_body" }, { status: 400 });

  if (body.kind === "personal") {
    if (!body.to_user) return NextResponse.json({ error: "missing_to_user" }, { status: 400 });
    const { data, error } = await sb.rpc("send_personal_message", {
      p_to_user: body.to_user, p_title: body.title, p_body: body.body,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message_id: data });
  }

  if (body.kind === "crew") {
    if (!body.subcategory) return NextResponse.json({ error: "missing_subcategory" }, { status: 400 });
    const { data, error } = await sb.rpc("post_crew_message", {
      p_subcategory: body.subcategory, p_title: body.title, p_body: body.body,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, recipients: data });
  }

  return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
}

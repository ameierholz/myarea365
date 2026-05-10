import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — letzte 50 Crew-Mails der eigenen Crew */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data: cm } = await sb.from("crew_members").select("crew_id").eq("user_id", user.id).maybeSingle<{ crew_id: string }>();
  if (!cm) return NextResponse.json({ ok: true, mails: [] });
  const { data, error } = await sb.from("crew_mail")
    .select("id, sender_id, kind, title, body, created_at")
    .eq("crew_id", cm.crew_id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mails: data ?? [] });
}

/** POST — Body: { kind, title, body } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const rl = await rateLimitSmart(`crewmail:${user.id}`, 10, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;
  const body = await req.json() as { kind?: string; title?: string; body?: string };
  if (!body.title || !body.body) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  const { data, error } = await sb.rpc("send_crew_mail", { p_kind: body.kind ?? "announcement", p_title: body.title, p_body: body.body });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

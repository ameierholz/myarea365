import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bumpQuestProgress } from "@/lib/quests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  → offene Crew-Bauten zum Helfen.
 * POST → einem konkreten Auftrag helfen ({ queue_id }).
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb.rpc("get_crew_buildings_for_help");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ builds: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const queueId = typeof body.queue_id === "string" ? body.queue_id : null;
  if (!queueId) return NextResponse.json({ error: "queue_id_required" }, { status: 400 });

  const { data, error } = await sb.rpc("help_crew_build", { p_queue_id: queueId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Quest-Progress: Crew-Hilfe geleistet
  await bumpQuestProgress(sb, user.id, "crew_help_given", 1);

  return NextResponse.json(data);
}

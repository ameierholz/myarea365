import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/arena/season/pick  → Liste der wählbaren Archetypen (Wächter aus der Collection des Users)
 * POST /api/arena/season/pick  → Wählt Saison-Wächter: body { archetype_id }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  // Alle Archetypen, die der User bereits besitzt (aus Wächter-Collection)
  // Fallback: alle verfügbaren Archetypen (für Starter)
  const { data: owned } = await sb.from("user_guardians")
    .select("archetype_id")
    .eq("user_id", auth.user.id);
  const ownedIds = Array.from(new Set((owned ?? []).map((r: { archetype_id: string }) => r.archetype_id)));

  const { data: archetypes } = await sb.from("guardian_archetypes")
    .select("id, name, emoji, rarity, guardian_type, role, ability_name, ability_desc");

  const all = archetypes ?? [];
  const list = ownedIds.length > 0
    ? all.filter((a: { id: string }) => ownedIds.includes(a.id))
    : all;

  return NextResponse.json({ ok: true, archetypes: list });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as { archetype_id?: string };
  if (!body.archetype_id) return NextResponse.json({ ok: false, error: "archetype_id fehlt" }, { status: 400 });

  const { data, error } = await sb.rpc("arena_season_pick_guardian", {
    p_user_id:      auth.user.id,
    p_archetype_id: body.archetype_id,
  });

  if (error) {
    const msg = error.message ?? "RPC-Fehler";
    const hint = msg.includes("does not exist") || error.code === "42883"
      ? "Migration 00031 fehlt — bitte im Supabase SQL Editor ausführen."
      : msg;
    return NextResponse.json({ ok: false, error: hint }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guardian_id: data });
}

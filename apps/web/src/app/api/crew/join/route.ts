import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/crew/join  { code: string }  → joint via Invite-Code */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });

  const { data: crew } = await sb.from("crews")
    .select("id, name, color, owner_id, faction")
    .ilike("invite_code", code)
    .maybeSingle<{ id: string; name: string; color: string | null; owner_id: string | null; faction: string | null }>();

  if (!crew) return NextResponse.json({ error: "crew_not_found" }, { status: 404 });

  // Bestehende Crew verlassen? Hier einfach upserten, als Member hinzufügen + current_crew_id setzen.
  const { error: memErr } = await sb.from("crew_members").upsert({
    crew_id: crew.id, user_id: user.id, role: "member",
  }, { onConflict: "crew_id,user_id" });
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  await sb.from("users").update({ current_crew_id: crew.id }).eq("id", user.id);

  // Solo-Territorien rückwirkend auf crew upgraden + 500 XP je Polygon
  let promotedCount = 0;
  let promotedXp = 0;
  try {
    const { data: promote } = await sb.rpc("promote_pending_territories", { p_user_id: user.id });
    if (Array.isArray(promote) && promote[0]) {
      promotedCount = (promote[0] as { promoted_count: number }).promoted_count ?? 0;
      promotedXp = (promote[0] as { xp_granted: number }).xp_granted ?? 0;
    }
  } catch { /* stumm */ }

  // Feed-Eintrag
  try {
    const { data: meRow } = await sb.from("users")
      .select("display_name, username").eq("id", user.id).maybeSingle<{ display_name: string | null; username: string | null }>();
    await sb.rpc("add_crew_feed", {
      p_crew_id: crew.id,
      p_user_id: user.id,
      p_kind: "member_joined",
      p_data: { display_name: meRow?.display_name ?? meRow?.username ?? null },
    });
  } catch { /* stumm */ }

  return NextResponse.json({
    ok: true,
    crew,
    promoted_territories: promotedCount,
    promoted_xp: promotedXp,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 * DSGVO Art. 20 — Self-Service-Export der eigenen Daten als JSON-Download.
 * Authentifizierter User bekommt nur seine eigenen Daten.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = user.id;

  const [
    profile, walks, territories, xp, achievements, redemptions,
    guardians, items, prestige, fights, missions, crewMembership,
  ] = await Promise.all([
    sb.from("users").select("*").eq("id", id).maybeSingle(),
    sb.from("walks").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(5000).then((r) => r, () => ({ data: [] })),
    sb.from("territory_polygons").select("*").eq("claimed_by_user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("xp_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(5000).then((r) => r, () => ({ data: [] })),
    sb.from("user_achievements").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("deal_redemptions").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_guardians").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_items").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_prestige").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("runner_fights").select("*").or(`attacker_id.eq.${id},defender_id.eq.${id}`).then((r) => r, () => ({ data: [] })),
    sb.from("user_missions").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("crew_members").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
  ]);

  if (!profile.data) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const payload = {
    export_generated_at: new Date().toISOString(),
    export_kind: "self_service_gdpr_art20",
    profile: profile.data,
    walks: walks.data ?? [],
    territories: territories.data ?? [],
    xp_transactions: xp.data ?? [],
    achievements: achievements.data ?? [],
    deal_redemptions: redemptions.data ?? [],
    guardians: guardians.data ?? [],
    items: items.data ?? [],
    prestige: prestige.data ?? [],
    fights: fights.data ?? [],
    missions: missions.data ?? [],
    crew_memberships: crewMembership.data ?? [],
  };

  const uname = (profile.data as { username: string | null }).username ?? id;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="myarea365_export_${uname}_${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}

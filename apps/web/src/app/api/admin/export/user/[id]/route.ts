import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export/user/[id]
 * DSGVO-konformer JSON-Export aller Daten eines Users.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await ctx.params;
  const sb = await createClient();

  const [
    user, walks, territories, xp, achievements, redemptions,
    guardians, items, prestige, fights,
  ] = await Promise.all([
    sb.from("users").select("*").eq("id", id).maybeSingle(),
    sb.from("walks").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(5000).then((r) => r, () => ({ data: [] })),
    sb.from("territory_polygons").select("*").eq("owner_user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("xp_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(5000).then((r) => r, () => ({ data: [] })),
    sb.from("user_achievements").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("deal_redemptions").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_guardians").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_items").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("user_prestige").select("*").eq("user_id", id).then((r) => r, () => ({ data: [] })),
    sb.from("runner_fights").select("*").or(`attacker_id.eq.${id},defender_id.eq.${id}`).then((r) => r, () => ({ data: [] })),
  ]);

  if (!user.data) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  await logAudit({
    action: "user.gdpr_export",
    targetType: "user",
    targetId: id,
    details: { exported_at: new Date().toISOString() },
  });

  const payload = {
    export_generated_at: new Date().toISOString(),
    user: user.data,
    walks: walks.data ?? [],
    territories: territories.data ?? [],
    xp_transactions: xp.data ?? [],
    achievements: achievements.data ?? [],
    deal_redemptions: redemptions.data ?? [],
    guardians: guardians.data ?? [],
    items: items.data ?? [],
    prestige: prestige.data ?? [],
    fights: fights.data ?? [],
  };

  const uname = (user.data as { username: string | null }).username ?? id;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="myarea365_export_${uname}_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

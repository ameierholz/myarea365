import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await ctx.params;
  const sb = await createClient();

  const body = await req.json() as {
    radius_m?: number;
    min_claims?: number;
    xp_bonus?: number;
    siegel_bonus?: number;
    force_activate_days?: number;
    deactivate?: boolean;
  };

  if (body.deactivate) {
    await sb.from("local_businesses")
      .update({ territory_bonus_until: null })
      .eq("id", id);
    await logAudit({
      action: "shop.territory_bonus_deactivate",
      targetType: "local_business", targetId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.force_activate_days && body.force_activate_days > 0) {
    const until = new Date(Date.now() + body.force_activate_days * 86400_000).toISOString();
    await sb.from("local_businesses")
      .update({ territory_bonus_until: until })
      .eq("id", id);
    await logAudit({
      action: "shop.territory_bonus_force_activate",
      targetType: "local_business", targetId: id,
      details: { days: body.force_activate_days, until },
    });
    return NextResponse.json({ ok: true, until });
  }

  const patch: Record<string, number> = {};
  if (typeof body.radius_m === "number")     patch.territory_bonus_radius_m    = Math.max(100, Math.min(2000, body.radius_m));
  if (typeof body.min_claims === "number")   patch.territory_bonus_min_claims  = Math.max(1, Math.min(100, body.min_claims));
  if (typeof body.xp_bonus === "number")     patch.territory_bonus_xp          = Math.max(0, Math.min(5000, body.xp_bonus));
  if (typeof body.siegel_bonus === "number") patch.territory_bonus_siegel      = Math.max(0, Math.min(10, body.siegel_bonus));

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "keine Parameter angegeben" }, { status: 400 });
  }

  const { error } = await sb.from("local_businesses").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await logAudit({
    action: "shop.territory_bonus_update",
    targetType: "local_business", targetId: id,
    details: patch,
  });

  return NextResponse.json({ ok: true, patch });
}

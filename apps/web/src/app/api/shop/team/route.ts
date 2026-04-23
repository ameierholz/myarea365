import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/shop/team?shop_id=... → Team-Mitglieder dieses Shops */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const shopId = new URL(req.url).searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ members: [] });

  const { data } = await sb.from("shop_team_members")
    .select("id, email, role, invited_at, accepted_at, user_id")
    .eq("shop_id", shopId)
    .order("invited_at", { ascending: false });
  return NextResponse.json({ members: data ?? [] });
}

/** POST /api/shop/team  Body: { shop_id, email, role? } → einladen */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as { shop_id: string; email: string; role?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!body.shop_id) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const role = ["manager", "staff"].includes(body.role ?? "") ? body.role! : "manager";

  // Prüfen, ob User mit dieser Mail schon existiert → direkt verlinken
  const { data: existing } = await sb.from("users").select("id").eq("email", email).maybeSingle<{ id: string }>();

  const { data, error } = await sb.from("shop_team_members").upsert({
    shop_id: body.shop_id,
    email,
    role,
    user_id: existing?.id ?? null,
    accepted_at: existing ? new Date().toISOString() : null,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
  }, { onConflict: "shop_id,email" }).select("*").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, member: data, existing_user: !!existing });
}

/** DELETE /api/shop/team?id=... */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { error } = await sb.from("shop_team_members").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

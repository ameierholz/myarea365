import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MissionInput = {
  id?: string;
  code: string;
  type: "daily" | "weekly";
  category: string;
  name: string;
  description: string;
  icon: string;
  target_metric: string;
  target_value: number;
  reward_xp: number;
  active?: boolean;
  sort_order?: number;
};

/** GET /api/admin/missions — Liste aller Missions für Admin */
export async function GET() {
  await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb.from("missions")
    .select("*")
    .order("type")
    .order("sort_order")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ missions: data ?? [] });
}

/** POST /api/admin/missions — Create */
export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  let body: MissionInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  if (!body.code || !body.name || !body.type || !body.target_metric) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await sb.from("missions").insert({
    code: body.code,
    type: body.type,
    category: body.category,
    name: body.name,
    description: body.description,
    icon: body.icon,
    target_metric: body.target_metric,
    target_value: body.target_value,
    reward_xp: body.reward_xp,
    active: body.active ?? true,
    sort_order: body.sort_order ?? 100,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission: data });
}

/** PATCH /api/admin/missions — Update (by id) */
export async function PATCH(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  let body: MissionInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await sb.from("missions").update({
    code: body.code,
    type: body.type,
    category: body.category,
    name: body.name,
    description: body.description,
    icon: body.icon,
    target_metric: body.target_metric,
    target_value: body.target_value,
    reward_xp: body.reward_xp,
    active: body.active ?? true,
    sort_order: body.sort_order ?? 100,
    updated_at: new Date().toISOString(),
  }).eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/missions?id=... — Löschen */
export async function DELETE(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await sb.from("missions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

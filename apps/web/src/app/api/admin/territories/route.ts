import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const query = sb
    .from("territory_polygons")
    .select("id, owner_user_id, area_m2, xp_awarded, created_at, users:owner_user_id(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data } = await query;
  type Row = { id: string; owner_user_id: string | null; area_m2: number | null; xp_awarded: number; created_at: string; users: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null };
  const rows = ((data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return {
      id: r.id,
      owner_user_id: r.owner_user_id,
      area_m2: r.area_m2,
      xp_awarded: r.xp_awarded,
      created_at: r.created_at,
      username: u?.username ?? null,
      display_name: u?.display_name ?? null,
    };
  });

  const filtered = q
    ? rows.filter((r) => (r.username ?? "").toLowerCase().includes(q.toLowerCase()) || (r.display_name ?? "").toLowerCase().includes(q.toLowerCase()))
    : rows;

  return NextResponse.json({ ok: true, rows: filtered });
}

export async function POST(req: NextRequest) {
  const { role, email } = await requireStaff();
  const sb = await createClient();
  const body = await req.json() as { action: "delete"; ids: string[] };

  if (body.action === "delete") {
    if (!body.ids?.length) return NextResponse.json({ ok: false, error: "keine IDs" }, { status: 400 });
    const { error } = await sb.from("territory_polygons").delete().in("id", body.ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await sb.from("admin_audit_log").insert({
      actor_email: email, actor_role: role,
      action: "territory_bulk_delete",
      target_type: "territory_polygons",
      target_id: null,
      metadata: { count: body.ids.length, ids: body.ids },
    });

    return NextResponse.json({ ok: true, deleted: body.ids.length });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

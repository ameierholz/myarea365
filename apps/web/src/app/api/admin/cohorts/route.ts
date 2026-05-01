import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/cohorts?filters=<JSON>
// Liefert: { count, sample[20], all_ids[max 5000] }
// Filter-Schema:
//   signup_after?: ISO  | signup_before?: ISO
//   xp_min?: number     | xp_max?: number
//   active_within_days?: number  (last walk innerhalb X Tagen)
//   inactive_for_days?: number   (KEIN walk innerhalb X Tagen)
//   faction?: 'kronenwacht' | 'gossenbund'
//   in_crew?: boolean
export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const filtersStr = req.nextUrl.searchParams.get("filters") || "{}";
  let filters: Record<string, unknown>;
  try { filters = JSON.parse(filtersStr); } catch { return NextResponse.json({ ok: false, error: "filters JSON invalid" }, { status: 400 }); }

  let q = sb.from("users").select("id, username, display_name, email, total_xp, total_distance_m, faction, created_at, last_login_at", { count: "exact" });
  if (filters.signup_after)  q = q.gte("created_at", String(filters.signup_after));
  if (filters.signup_before) q = q.lte("created_at", String(filters.signup_before));
  if (filters.xp_min != null) q = q.gte("total_xp", Number(filters.xp_min));
  if (filters.xp_max != null) q = q.lte("total_xp", Number(filters.xp_max));
  if (filters.faction) q = q.eq("faction", String(filters.faction));

  // Aktivitäts-Filter: über walks-Tabelle, dann gegen IDs filtern
  if (filters.active_within_days || filters.inactive_for_days) {
    const days = Number(filters.active_within_days ?? filters.inactive_for_days);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data: walkers } = await sb.from("walks").select("user_id").gte("created_at", cutoff);
    const walkerIds = [...new Set((walkers ?? []).map((w) => w.user_id))];
    if (filters.active_within_days) {
      if (walkerIds.length === 0) q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      else q = q.in("id", walkerIds);
    } else {
      if (walkerIds.length > 0) q = q.not("id", "in", `(${walkerIds.map((id) => `"${id}"`).join(",")})`);
    }
  }

  // In-Crew-Filter
  if (filters.in_crew != null) {
    const { data: members } = await sb.from("group_members").select("user_id");
    const inCrew = [...new Set((members ?? []).map((m) => m.user_id))];
    if (filters.in_crew) {
      if (inCrew.length === 0) q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      else q = q.in("id", inCrew);
    } else {
      if (inCrew.length > 0) q = q.not("id", "in", `(${inCrew.map((id) => `"${id}"`).join(",")})`);
    }
  }

  const { data, count, error } = await q.limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: count ?? 0, sample: data ?? [] });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/challenges?crew_id=... */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("crew_challenges")
    .select("*")
    .eq("crew_id", crewId)
    .order("ends_at", { ascending: true })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenges: data ?? [] });
}

/** POST /api/crew/challenges  → Admin/Owner legt Challenge an */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    crew_id?: string;
    name?: string;
    description?: string;
    icon?: string;
    target_metric?: "weekly_km" | "new_streets" | "territories" | "arena_wins" | "members_active";
    target_value?: number;
    reward_xp?: number;
    days?: number;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  if (!body.crew_id || !body.name || !body.target_metric || !body.target_value) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Nur Admin/Owner der Crew darf
  const { data: mem } = await sb.from("crew_members")
    .select("role").eq("crew_id", body.crew_id).eq("user_id", user.id).maybeSingle<{ role: string }>();
  if (!mem || !["admin", "owner"].includes(mem.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const days = Math.max(1, Math.min(30, body.days ?? 7));
  const endsAt = new Date(Date.now() + days * 86400000).toISOString();

  const { data, error } = await sb.from("crew_challenges").insert({
    crew_id: body.crew_id,
    name: body.name,
    description: body.description ?? null,
    icon: body.icon ?? "🎯",
    target_metric: body.target_metric,
    target_value: body.target_value,
    reward_xp: body.reward_xp ?? 2500,
    ends_at: endsAt,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenge: data });
}

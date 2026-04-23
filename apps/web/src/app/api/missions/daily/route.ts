import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MissionRow = {
  id: string;
  assigned_for_date: string;
  progress: number | null;
  completed_at: string | null;
  claimed_at: string | null;
  mission: {
    id: string; code: string; type: string; category: string;
    name: string; description: string; icon: string;
    target_metric: string; target_value: number; reward_xp: number;
  };
};

/**
 * GET /api/missions/daily
 * Assigned heute: 3 Dailies + 1 Weekly (wenn noch nicht zugewiesen) und
 * liefert sie mit Fortschritt zurueck.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Zuerst Zuweisung ausfuehren (RPC ist idempotent)
  try {
    await sb.rpc("assign_daily_missions", { p_user_id: user.id });
  } catch { /* stumm — ggf. noch nicht migriert */ }

  // Berliner "heute" und Montag dieser Woche
  const berlin = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const today = berlin.toISOString().slice(0, 10);
  const monday = (() => {
    const d = new Date(berlin);
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  })();

  const { data, error } = await sb
    .from("user_missions")
    .select("id, assigned_for_date, progress, completed_at, claimed_at, mission:mission_id(id, code, type, category, name, description, icon, target_metric, target_value, reward_xp)")
    .eq("user_id", user.id)
    .in("assigned_for_date", [today, monday])
    .returns<MissionRow[]>();

  if (error) {
    return NextResponse.json({ error: "fetch_failed", detail: error.message, missions: [] }, { status: 500 });
  }

  const missions = (data ?? [])
    .filter((r) => r.mission)
    .map((r) => ({
      assignment_id: r.id,
      id: r.mission.id,
      code: r.mission.code,
      type: r.mission.type as "daily" | "weekly",
      category: r.mission.category,
      name: r.mission.name,
      description: r.mission.description,
      icon: r.mission.icon,
      target_metric: r.mission.target_metric,
      target: r.mission.target_value,
      reward_xp: r.mission.reward_xp,
      progress: Number(r.progress ?? 0),
      completed_at: r.completed_at,
      claimed_at: r.claimed_at,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "daily" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ missions });
}

/**
 * POST /api/missions/daily
 * Body: { assignment_id, action: "claim" }
 * Reward einloesen, wenn completed_at gesetzt und claimed_at noch null.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Rate-Limit: 30 Claims/Minute reichen auch für Power-User.
  const rl = rateLimit(`mission_claim:${user.id}`, 30, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  let body: { assignment_id?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (body.action !== "claim" || !body.assignment_id) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // Zuweisung + Mission laden (+ Besitz prüfen)
  const { data: row } = await sb
    .from("user_missions")
    .select("id, user_id, completed_at, claimed_at, mission:mission_id(reward_xp)")
    .eq("id", body.assignment_id)
    .maybeSingle<{ id: string; user_id: string; completed_at: string | null; claimed_at: string | null; mission: { reward_xp: number } | { reward_xp: number }[] | null }>();

  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!row.completed_at) return NextResponse.json({ error: "not_completed" }, { status: 400 });
  if (row.claimed_at) return NextResponse.json({ error: "already_claimed" }, { status: 400 });

  const mission = Array.isArray(row.mission) ? row.mission[0] : row.mission;
  const rewardXp = mission?.reward_xp ?? 0;

  const { error: updErr } = await sb.from("user_missions")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  if (rewardXp > 0) {
    const { data: userRow } = await sb.from("users").select("wegemuenzen").eq("id", user.id).single<{ wegemuenzen: number | null }>();
    await sb.from("users").update({ wegemuenzen: (userRow?.wegemuenzen ?? 0) + rewardXp }).eq("id", user.id);
  }

  return NextResponse.json({ ok: true, reward_wegemuenzen: rewardXp });
}

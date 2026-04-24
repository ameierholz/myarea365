import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/kiez?plz=10827
 *
 * Ohne plz-Parameter: Liste aller aktuellen Kiez-Könige (Top-Runner je PLZ
 * der letzten abgeschlossenen Woche). Gut für Übersicht.
 *
 * Mit plz: Top-10-Ranking innerhalb dieser PLZ für die LAUFENDE Woche —
 * so siehst du live, wer morgen die Krone holt.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const plzFilter = url.searchParams.get("plz");
  const sb = await createClient();

  if (plzFilter && /^[0-9]{5}$/.test(plzFilter)) {
    // Aktuelle Woche: Montag 00:00 in UTC
    const now = new Date();
    const day = now.getUTCDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
    const thisMondayISO = thisMonday.toISOString().slice(0, 10);

    const { data: viewRows } = await sb
      .from("weekly_plz_km")
      .select("user_id, total_m, segments_count, week_start")
      .eq("plz", plzFilter)
      .eq("week_start", thisMondayISO)
      .order("total_m", { ascending: false })
      .limit(10);

    const filtered = (viewRows ?? []) as Array<{ user_id: string; total_m: number; segments_count: number; week_start: string }>;

    // User-Details nachladen
    const userIds = filtered.map((r) => r.user_id);
    const users = userIds.length > 0
      ? (await sb.from("users").select("id, display_name, username, heimat_plz").in("id", userIds)).data ?? []
      : [];
    const byId = new Map<string, { display_name: string | null; username: string | null; heimat_plz: string | null }>();
    for (const u of users as Array<{ id: string; display_name: string | null; username: string | null; heimat_plz: string | null }>) {
      byId.set(u.id, u);
    }

    return NextResponse.json({
      plz: plzFilter,
      week_start: thisMondayISO,
      ranking: filtered.map((r, i) => ({
        rank: i + 1,
        user_id: r.user_id,
        display_name: byId.get(r.user_id)?.display_name ?? null,
        username: byId.get(r.user_id)?.username ?? null,
        heimat_plz: byId.get(r.user_id)?.heimat_plz ?? null,
        total_km: Number((r.total_m / 1000).toFixed(2)),
        segments: r.segments_count,
      })),
    });
  }

  // Übersicht: alle aktuellen Könige
  const { data: kings } = await sb
    .from("current_plz_kings")
    .select("plz, user_id, total_m, segments_count, week_start")
    .order("plz");

  const rows = (kings ?? []) as Array<{ plz: string; user_id: string; total_m: number; segments_count: number; week_start: string }>;
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const users = userIds.length > 0
    ? (await sb.from("users").select("id, display_name, username, heimat_plz").in("id", userIds)).data ?? []
    : [];
  const byId = new Map<string, { display_name: string | null; username: string | null; heimat_plz: string | null }>();
  for (const u of users as Array<{ id: string; display_name: string | null; username: string | null; heimat_plz: string | null }>) {
    byId.set(u.id, u);
  }

  return NextResponse.json({
    kings: rows.map((r) => ({
      plz: r.plz,
      user_id: r.user_id,
      display_name: byId.get(r.user_id)?.display_name ?? null,
      username: byId.get(r.user_id)?.username ?? null,
      heimat_plz: byId.get(r.user_id)?.heimat_plz ?? null,
      total_km: Number((r.total_m / 1000).toFixed(2)),
      segments: r.segments_count,
      week_start: r.week_start,
    })),
  });
}

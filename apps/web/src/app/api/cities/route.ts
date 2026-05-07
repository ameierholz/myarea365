import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cities — Server-Übersicht für In-Game-Modal.
 *
 * Liefert alle aktiven Stadt-Server inkl. aktueller Ära, Spielerzahl,
 * Crew-Anzahl und Top-Crew. Markiert die Heimat-Stadt des aufrufenden Users.
 *
 * Response:
 *   {
 *     home_city_slug: string | null,    // null wenn noch nicht zugewiesen
 *     servers: [
 *       {
 *         slug, name, country, opened_at,
 *         era: { number, started_at, days_running },
 *         stats: { player_count, crew_count },
 *         top_crew: { id, name, members } | null,
 *         is_home: boolean,
 *       }
 *     ]
 *   }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Heimat-Stadt des Users
  const { data: u } = await sb
    .from("users")
    .select("home_city_slug")
    .eq("id", auth.user.id)
    .maybeSingle();
  const homeSlug = (u as { home_city_slug?: string | null } | null)?.home_city_slug ?? null;

  // Alle aktiven Server
  const { data, error } = await sb.rpc("list_cities_with_stats");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    slug: string; name: string; country: string;
    opened_at: string;
    current_era_number: number | null;
    era_started_at: string | null;
    era_days_running: number | null;
    player_count: number; crew_count: number;
    top_crew_id: string | null;
    top_crew_name: string | null;
    top_crew_members: number;
  };
  const rows = (data ?? []) as Row[];

  const servers = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    country: r.country,
    opened_at: r.opened_at,
    era: r.current_era_number != null ? {
      number: r.current_era_number,
      started_at: r.era_started_at,
      days_running: r.era_days_running ?? 0,
    } : null,
    stats: {
      player_count: Number(r.player_count) || 0,
      crew_count: Number(r.crew_count) || 0,
    },
    top_crew: r.top_crew_id ? {
      id: r.top_crew_id,
      name: r.top_crew_name ?? "—",
      members: Number(r.top_crew_members) || 0,
    } : null,
    is_home: r.slug === homeSlug,
  }));

  return NextResponse.json({ home_city_slug: homeSlug, servers });
}

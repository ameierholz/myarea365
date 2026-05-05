import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verwaltung der drei Saison-Systeme (Shop-Liga, Arena, Turf-Krieg).
 *
 * GET    → Snapshot: pro System Active-Seasons + letzte 10 finalisierten +
 *          Reward-Tier-Tabelle.
 * POST   → action-Dispatch:
 *   { system: "shop_league"|"arena"|"turf_war", action: "finalize_now" }
 *   { system, action: "force_close_active" }   (nur Shop-Liga / Turf-Krieg)
 *   { system, action: "update_tiers", tiers: [{ id?, rank_min, rank_max,
 *      gebietsruf?, gems?, siegel_universal?, participation_only?, label? }, ...] }
 */
export async function GET() {
  await requireStaff();
  const sb = await createClient();

  // shop_league_seasons archived (pivot 2026-05-05)
  const [tiers, arenaActive, arenaRecent, turfActive, turfRecent] = await Promise.all([
    sb.from("season_reward_tiers")
      .select("id, system, rank_min, rank_max, gebietsruf, gems, siegel_universal, participation_only, label")
      .order("system").order("rank_min"),
    sb.from("arena_seasons")
      .select("id, name, starts_at, ends_at, status")
      .eq("status", "active").limit(5),
    sb.from("arena_seasons")
      .select("id, name, starts_at, ends_at, status")
      .eq("status", "archived").order("ends_at", { ascending: false }).limit(10),
    sb.from("crew_seasons")
      .select("id, year, month, starts_at, ends_at, status")
      .eq("status", "active").order("ends_at", { ascending: true }).limit(5),
    sb.from("crew_seasons")
      .select("id, year, month, starts_at, ends_at, status")
      .eq("status", "finalized").order("ends_at", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    ok: true,
    tiers: tiers.data ?? [],
    shop_league: { active: [], recent: [] },
    arena:       { active: arenaActive.data ?? [], recent: arenaRecent.data ?? [] },
    turf_war:    { active: turfActive.data ?? [],  recent: turfRecent.data ?? [] },
    saga:        { active: [], recent: [], cities: [] },
  });
}

type TierUpdate = {
  id?: string;
  rank_min: number;
  rank_max: number;
  gebietsruf?: number;
  gems?: number;
  siegel_universal?: number;
  participation_only?: boolean;
  label?: string | null;
};

export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const body = await req.json() as {
    system?: "shop_league" | "arena" | "turf_war" | "saga";
    action?: "finalize_now" | "force_close_active" | "update_tiers" | "saga_create" | "saga_finalize_buildup";
    tiers?: TierUpdate[];
    name?: string;
    buildup_starts?: string;
    cities?: Array<{ name: string; slug: string; color_hex?: string }>;
    season_id?: string;
  };

  if (!body.system || !body.action) {
    return NextResponse.json({ ok: false, error: "system + action required" }, { status: 400 });
  }

  // ─── finalize_now ───────────────────────────────────────────────
  if (body.action === "finalize_now") {
    if (body.system === "shop_league") {
      // shop_league archived (pivot 2026-05-05)
      return NextResponse.json({ ok: false, error: "shop_league_archived" }, { status: 410 });
    }
    if (body.system === "turf_war") {
      const { data, error } = await sb.rpc("finalize_crew_seasons");
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, finalized: data ?? [] });
    }
    if (body.system === "arena") {
      const { data, error } = await sb.rpc("arena_season_finalize");
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, result: data });
    }
    if (body.system === "saga") {
      const { data, error } = await sb.rpc("saga_finalize_season", { p_season_id: body.season_id ?? null });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, result: data });
    }
  }

  // ─── saga_create — neue Saga-Saison anlegen ─────────────────────
  if (body.action === "saga_create" && body.system === "saga") {
    if (!body.name || !body.buildup_starts || !Array.isArray(body.cities) || body.cities.length < 2) {
      return NextResponse.json({ ok: false, error: "name + buildup_starts + cities[≥2] required" }, { status: 400 });
    }
    const { data, error } = await sb.rpc("saga_create_season", {
      p_name: body.name,
      p_buildup_starts: body.buildup_starts,
      p_cities: body.cities,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, season_id: data });
  }

  // ─── saga_finalize_buildup — Auftakt-Sieger küren ───────────────
  if (body.action === "saga_finalize_buildup" && body.system === "saga") {
    const { data, error } = await sb.rpc("saga_finalize_buildup", { p_season_id: body.season_id ?? null });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  // ─── force_close_active (Shop-Liga + Turf-Krieg) ────────────────
  if (body.action === "force_close_active") {
    if (body.system === "shop_league") {
      return NextResponse.json({ ok: false, error: "shop_league_archived" }, { status: 410 });
    }
    if (body.system === "turf_war") {
      await sb.from("crew_seasons").update({ ends_at: new Date(Date.now() - 1000).toISOString() })
        .eq("status", "active");
      const { data } = await sb.rpc("finalize_crew_seasons");
      return NextResponse.json({ ok: true, finalized: data ?? [] });
    }
    if (body.system === "arena") {
      // Arena hat eigene end-Logik via arena_season_end (über season_finalize wrapper)
      const { data } = await sb.rpc("arena_season_finalize");
      return NextResponse.json({ ok: true, result: data });
    }
  }

  // ─── update_tiers ───────────────────────────────────────────────
  if (body.action === "update_tiers") {
    if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
      return NextResponse.json({ ok: false, error: "tiers array required" }, { status: 400 });
    }
    // Validierung
    for (const t of body.tiers) {
      if (typeof t.rank_min !== "number" || typeof t.rank_max !== "number") {
        return NextResponse.json({ ok: false, error: "rank_min/rank_max required" }, { status: 400 });
      }
      if (t.rank_min > t.rank_max) {
        return NextResponse.json({ ok: false, error: `rank_min ${t.rank_min} > rank_max ${t.rank_max}` }, { status: 400 });
      }
    }
    // Strategie: alle bestehenden Tiers für das System löschen und neu einfügen
    // (atomar via Transaction nicht trivial in Supabase Client — wir machen es
    // sequentiell und akzeptieren die kurze Inkonsistenz; im Fehlerfall returnen)
    const del = await sb.from("season_reward_tiers").delete().eq("system", body.system);
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
    const inserts = body.tiers.map((t) => ({
      system: body.system,
      rank_min: t.rank_min,
      rank_max: t.rank_max,
      gebietsruf: t.gebietsruf ?? 0,
      gems: t.gems ?? 0,
      siegel_universal: t.siegel_universal ?? 0,
      participation_only: t.participation_only ?? false,
      label: t.label ?? null,
      updated_at: new Date().toISOString(),
    }));
    const ins = await sb.from("season_reward_tiers").insert(inserts);
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, written: inserts.length });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

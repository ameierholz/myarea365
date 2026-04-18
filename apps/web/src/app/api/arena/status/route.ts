import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/status?business_id=<uuid>
 *
 * Liefert:
 * - arena: {id, plan, expires_at, total_battles} | null
 * - my_crew_eligible: boolean
 * - my_crew_last_redemption_at: timestamp | null
 * - recent_battles: Array<{...}>
 * - waiting_challengers: Anzahl eligible Crews
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();

  // Arena-Status
  const { data: arena } = await sb.from("shop_arenas")
    .select("id, status, plan, activated_at, expires_at, total_battles")
    .eq("business_id", businessId)
    .maybeSingle<{ id: string; status: string; plan: string; activated_at: string; expires_at: string; total_battles: number }>();

  const arenaActive = arena && arena.status === "active" && new Date(arena.expires_at).getTime() > Date.now();

  let myCrewId: string | null = null;
  let myCrewEligible = false;
  let myCrewLastRedemption: string | null = null;

  if (auth?.user) {
    const { data: profile } = await sb.from("users")
      .select("current_crew_id")
      .eq("id", auth.user.id)
      .maybeSingle<{ current_crew_id: string | null }>();
    myCrewId = profile?.current_crew_id ?? null;
    if (myCrewId && arenaActive) {
      const { data: eligibility } = await sb.rpc("arena_eligibility", {
        p_crew_id: myCrewId,
        p_business_id: businessId,
      });
      if (eligibility && typeof eligibility === "object") {
        const e = eligibility as { eligible: boolean; last_redemption_at: string | null };
        myCrewEligible = e.eligible;
        myCrewLastRedemption = e.last_redemption_at;
      }
    }
  }

  // Historie (letzte 10 Kaempfe)
  let recentBattles: Array<{
    id: string;
    challenger_crew: { id: string; name: string } | null;
    defender_crew: { id: string; name: string } | null;
    winner_crew_id: string | null;
    created_at: string;
  }> = [];
  if (arena) {
    const { data } = await sb.from("arena_battles")
      .select("id, challenger_crew_id, defender_crew_id, winner_crew_id, created_at")
      .eq("arena_id", arena.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data && data.length > 0) {
      const crewIds = Array.from(new Set(data.flatMap((b) => [b.challenger_crew_id, b.defender_crew_id])));
      const { data: crews } = await sb.from("crews").select("id, name").in("id", crewIds);
      const crewMap = new Map((crews ?? []).map((c: { id: string; name: string }) => [c.id, c]));
      recentBattles = data.map((b) => ({
        id: b.id,
        challenger_crew: crewMap.get(b.challenger_crew_id) ?? null,
        defender_crew: crewMap.get(b.defender_crew_id) ?? null,
        winner_crew_id: b.winner_crew_id,
        created_at: b.created_at,
      }));
    }
  }

  return NextResponse.json({
    arena: arenaActive ? arena : null,
    my_crew_id: myCrewId,
    my_crew_eligible: myCrewEligible,
    my_crew_last_redemption_at: myCrewLastRedemption,
    recent_battles: recentBattles,
  });
}

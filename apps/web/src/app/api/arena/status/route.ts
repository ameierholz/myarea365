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

  let iRedeemedMyself = false;
  let myLastRedemption: string | null = null;
  let crewEligible = false;
  let crewLastRedemption: string | null = null;

  if (auth?.user && arenaActive) {
    // Selbst eingeloest?
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: myRed } = await sb.from("deal_redemptions")
      .select("verified_at")
      .eq("user_id", auth.user.id)
      .eq("business_id", businessId)
      .eq("status", "verified")
      .gte("verified_at", since)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ verified_at: string }>();
    if (myRed) {
      iRedeemedMyself = true;
      myLastRedemption = myRed.verified_at;
    }

    // Crew eligible (Mitglied hat in 7T eingeloest)?
    const { data: profile } = await sb.from("users")
      .select("current_crew_id")
      .eq("id", auth.user.id)
      .maybeSingle<{ current_crew_id: string | null }>();
    if (profile?.current_crew_id) {
      const { data: eligibility } = await sb.rpc("arena_eligibility", {
        p_crew_id: profile.current_crew_id,
        p_business_id: businessId,
      });
      if (eligibility && typeof eligibility === "object") {
        const e = eligibility as { eligible: boolean; last_redemption_at: string | null };
        crewEligible = e.eligible;
        crewLastRedemption = e.last_redemption_at;
      }
    }
  }
  const iEligible = iRedeemedMyself || crewEligible;

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
    i_eligible: iEligible,
    i_redeemed_myself: iRedeemedMyself,
    crew_eligible: crewEligible,
    my_last_redemption_at: myLastRedemption,
    crew_last_redemption_at: crewLastRedemption,
    recent_battles: recentBattles,
  });
}

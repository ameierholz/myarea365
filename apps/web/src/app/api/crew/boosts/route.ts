import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const BOOST_CATALOG: Record<string, { cost: number; duration_hours: number | null; name: string; icon: string; description: string }> = {
  score_24h:        { cost: 300,  duration_hours: 24,      name: "Crew-Score-Boost 24h",  icon: "⚡", description: "Alle Duell/War/Saison-Punkte 1.5× für 24 Stunden" },
  score_7d:         { cost: 1500, duration_hours: 24 * 7,  name: "Crew-Score-Boost 7 Tage", icon: "⚡", description: "Selber Effekt, 7 Tage am Stück" },
  war_momentum:     { cost: 500,  duration_hours: 24,      name: "War-Momentum",          icon: "🔥", description: "+20% War-Score für 24h (nur während aktivem Krieg)" },
  flag_spawn:       { cost: 800,  duration_hours: null,    name: "Flaggen-Spawn",         icon: "🚩", description: "Admin platziert eine Flagge frei" },
  challenge_reroll: { cost: 200,  duration_hours: null,    name: "Challenge-Reroll",      icon: "🎲", description: "Eine aktuelle Challenge neu ziehen" },
  territory_shield: { cost: 1000, duration_hours: 48,      name: "Territorium-Schutz 48h", icon: "🛡️", description: "48 Stunden Steal-Schutz für alle Crew-Territorien" },
  duel_pick:        { cost: 500,  duration_hours: null,    name: "Duel-Pick",             icon: "🎯", description: "Nächsten Wochen-Duel-Gegner selbst wählen" },
};

/** GET /api/crew/boosts?crew_id=... → aktive + Katalog */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data: active } = await sb.from("crew_boosts")
    .select("id, kind, activated_at, expires_at, consumed_at, gems_paid")
    .eq("crew_id", crewId)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .is("consumed_at", null)
    .order("activated_at", { ascending: false });

  return NextResponse.json({
    catalog: BOOST_CATALOG,
    active: active ?? [],
  });
}

/** POST /api/crew/boosts  { crew_id, kind } → Activate */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { crew_id?: string; kind?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.crew_id || !body.kind) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!(body.kind in BOOST_CATALOG)) return NextResponse.json({ error: "unknown_kind" }, { status: 400 });

  const { data, error } = await sb.rpc("crew_activate_boost", {
    p_user_id: user.id, p_crew_id: body.crew_id, p_kind: body.kind,
  });
  if (error) {
    const msg = error.message;
    const userMsg = msg.includes("admin_only") ? "Nur Admins/Owner können Boosts aktivieren."
      : msg.includes("insufficient_pool") ? "Nicht genug Diamanten im Crew-Pool."
      : msg.includes("weekly_limit_reached") ? "Wöchentliches Boost-Limit (72 h) erreicht."
      : msg.includes("already_active") ? "Dieser Boost ist bereits aktiv."
      : msg.includes("no_active_war") ? "War-Momentum nur während eines aktiven Krieges verfügbar."
      : msg;
    return NextResponse.json({ error: userMsg }, { status: 400 });
  }

  return NextResponse.json(data ?? { ok: true });
}

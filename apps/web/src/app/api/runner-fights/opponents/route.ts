import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_NAMES = ["Trainings-Dummy", "Kadett", "Sparring-Partner", "Schatten-Rekrut", "Arena-Gast", "Wandervogel", "Asphalt-Athlet", "Wildgänger", "Strassen-Geist", "Nachtschicht"];

/**
 * GET /api/runner-fights/opponents?refresh=1
 * Liefert 10 Matchmade-Gegner + Tagesstatus.
 * Dev-Fallback: wenn zu wenige echte Gegner existieren, mit Bots auffüllen.
 */
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    const [oppRes, stateRes, gemsRes] = await Promise.all([
      sb.rpc("runner_fight_get_opponents", { p_user_id: user.id, p_force_refresh: refresh }),
      sb.from("runner_fight_state").select("fights_used_today, gems_spent_today, refresh_used_today").eq("user_id", user.id).maybeSingle(),
      sb.from("user_gems").select("gems").eq("user_id", user.id).maybeSingle(),
    ]);

    if (oppRes.error) {
      const msg = oppRes.error.message ?? "RPC-Fehler";
      const hint = msg.includes("does not exist") || oppRes.error.code === "42883" || oppRes.error.code === "42P01"
        ? "Migration 00027 fehlt — bitte im Supabase SQL Editor ausführen."
        : msg;
      return NextResponse.json({ ok: false, error: "rpc_failed", detail: hint, opponents: [] }, { status: 500 });
    }
    if (stateRes.error && stateRes.error.code === "42P01") {
      return NextResponse.json({ ok: false, error: "table_missing", detail: "Migration 00027 fehlt.", opponents: [] }, { status: 500 });
    }

    const state = stateRes.data;
    const gems = gemsRes.data;
    const fightsUsed = state?.fights_used_today ?? 0;
    const { data: nextCost } = await sb.rpc("runner_fight_next_gem_cost", { p_used: fightsUsed });

    const oppData = (oppRes.data as { ok?: boolean; opponents?: Array<Record<string, unknown>>; error?: string } | null) ?? { ok: true, opponents: [] };
    const realOpponents = oppData.opponents ?? [];

    // Dev-Fallback: mit Bots auffüllen
    let opponents = [...realOpponents];
    if (opponents.length < 10 && oppData.error !== "no_active_guardian") {
      const { data: myGuardian } = await sb.from("user_guardians").select("level").eq("user_id", user.id).eq("is_active", true).maybeSingle<{ level: number }>();
      const myLevel = myGuardian?.level ?? 1;
      const { data: archetypes } = await sb.from("guardian_archetypes")
        .select("id, name, emoji, rarity, guardian_type, role");
      const shuffled = (archetypes ?? []).slice().sort(() => Math.random() - 0.5);
      const botsNeeded = 10 - opponents.length;
      for (let i = 0; i < botsNeeded && i < shuffled.length; i++) {
        const a = shuffled[i] as { id: string; name: string; emoji: string; rarity: string; guardian_type: string; role: string };
        const levelOffset = Math.floor(Math.random() * 7) - 3;
        const level = Math.max(1, Math.min(60, myLevel + levelOffset));
        opponents.push({
          guardian_id: `bot-${a.id}-${level}-${i}-${Date.now()}`,
          user_id: `bot-user-${i}`,
          archetype_id: a.id,
          level,
          wins: Math.floor(Math.random() * 20),
          losses: Math.floor(Math.random() * 15),
          current_hp_pct: 100,
          username: (BOT_NAMES[i] ?? `bot_${i}`).toLowerCase().replace(/[\s-]/g, "_"),
          display_name: BOT_NAMES[i] ?? `Bot ${i+1}`,
          faction: Math.random() > 0.5 ? "syndicate" : "vanguard",
          avatar_url: null,
          archetype_name: a.name,
          archetype_emoji: a.emoji,
          rarity: a.rarity,
          guardian_type: a.guardian_type,
          role: a.role,
          is_bot: true,
        });
      }
    }

    return NextResponse.json({
      ok: oppData.ok !== false || opponents.length > 0 || oppData.error === "no_active_guardian" ? (oppData.error === "no_active_guardian" ? false : true) : false,
      error: oppData.error,
      opponents,
      fights_used_today: fightsUsed,
      gems_spent_today: state?.gems_spent_today ?? 0,
      refresh_used_today: state?.refresh_used_today ?? 0,
      next_gem_cost: nextCost,
      gems_available: gems?.gems ?? 0,
      refresh_cost: (state?.refresh_used_today ?? 0) < 1 ? 0 : 30,
    });
  } catch (e) {
    console.error("[runner-fights/opponents] unexpected", e);
    return NextResponse.json({
      ok: false,
      error: "exception",
      detail: e instanceof Error ? e.message : String(e),
      opponents: [],
    }, { status: 500 });
  }
}

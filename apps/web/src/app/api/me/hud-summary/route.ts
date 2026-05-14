import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RUNNER_RANKS } from "@/lib/game-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/hud-summary
 *   → Aggregierter Snapshot für die Karten-HUD-Bar.
 *     Liefert in 1 Round-Trip: User-Profil-Kerndaten, Vertrauen, VIP-Level,
 *     Diamanten, Crew-Resources (Tech-Schrott/Komponenten/Krypto/Bandbreite),
 *     Speed-Tokens + aktive Buffs.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [profile, vip, gems, res, buffs, quests] = await Promise.all([
    sb.from("users")
      .select("id, username, display_name, avatar_url, level, gebietsruf, ansehen, xp, home_city_slug, equipped_base_ring_id")
      .eq("id", user.id)
      .maybeSingle(),
    sb.from("vip_progress")
      .select("vip_level, vip_points")
      .eq("user_id", user.id)
      .maybeSingle(),
    sb.from("user_gems")
      .select("gems")
      .eq("user_id", user.id)
      .maybeSingle(),
    sb.from("user_resources")
      .select("wood, stone, gold, mana, speed_tokens, vip_tickets")
      .eq("user_id", user.id)
      .maybeSingle(),
    sb.rpc("get_user_active_buffs").then(
      (r) => r,
      () => ({ data: [] as Array<{ key: string; label?: string; ends_at?: string; magnitude?: number }> })
    ),
    sb.rpc("get_user_quests").then(
      (r) => r,
      () => ({ data: null as { summary?: { claimable: number; in_progress: number } } | null })
    ),
  ]);

  // Avatar Rahmen (DB-Slot base_ring) — equippt vom User. Wenn nichts equippt
  // ist, fällt der Halo auf den "default"-Slot zurück (immer vorhanden).
  let avatar_rahmen: { image_url: string | null; video_url: string | null } | null = null;
  const ringId = profile.data?.equipped_base_ring_id || "default";
  const { data: ringArt } = await sb
    .from("cosmetic_artwork")
    .select("image_url, video_url")
    .eq("kind", "base_ring")
    .eq("slot_id", ringId)
    .maybeSingle();
  if (ringArt && (ringArt.image_url || ringArt.video_url)) {
    avatar_rahmen = { image_url: ringArt.image_url, video_url: ringArt.video_url };
  }

  // "Vertrauen" = Composite: gebietsruf + ansehen + level*100 (provisorisch)
  const p = profile.data ?? null;
  const vertrauen = p
    ? Math.max(0, (p.gebietsruf ?? 0) + (p.ansehen ?? 0) + ((p.level ?? 0) * 100))
    : 0;

  // Aktuellen Rang aus XP ableiten (höchster Rank, dessen minXp erreicht ist).
  const xp = p?.xp ?? 0;
  const rank = [...RUNNER_RANKS].reverse().find((r) => xp >= r.minXp) ?? RUNNER_RANKS[0];

  return NextResponse.json({
    ok: true,
    user: p ? {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      level: p.level ?? 1,
      home_city_slug: p.home_city_slug,
    } : null,
    vertrauen,
    vip_level: vip.data?.vip_level ?? 0,
    vip_points: vip.data?.vip_points ?? 0,
    gems: gems.data?.gems ?? 0,
    resources: {
      wood: res.data?.wood ?? 0,
      stone: res.data?.stone ?? 0,
      gold: res.data?.gold ?? 0,
      mana: res.data?.mana ?? 0,
      speed_tokens: res.data?.speed_tokens ?? 0,
      vip_tickets: res.data?.vip_tickets ?? 0,
    },
    buffs: Array.isArray(buffs.data) ? buffs.data : [],
    avatar_rahmen,
    rank: { id: rank.id, name: rank.name, color: rank.color },
    quests: {
      claimable: ((quests.data as unknown as { summary?: { claimable?: number } } | null)?.summary?.claimable) ?? 0,
      in_progress: ((quests.data as unknown as { summary?: { in_progress?: number } } | null)?.summary?.in_progress) ?? 0,
    },
  });
}

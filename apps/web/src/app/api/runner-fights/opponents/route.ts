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

    // Eigener aktiver Wächter (für Hero-Anzeige) + Base-Stats
    const { data: myGuardianRow } = await sb.from("user_guardians")
      .select("id, archetype_id, level, xp, wins, losses, current_hp_pct, guardian_archetypes!inner(name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    type ArchRow = { name: string; emoji: string; rarity: string; guardian_type: string | null; role: string | null; base_hp: number; base_atk: number; base_def: number; base_spd: number };
    const arch = myGuardianRow ? (myGuardianRow as unknown as { guardian_archetypes: ArchRow }).guardian_archetypes : null;

    // Equipped + Inventar (für Hero-Anzeige & inline Slot-Picker)
    type EqItem = { user_item_id: string; slot: string; name: string; emoji: string; rarity: string; upgrade_tier: number; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; image_url: string | null };
    let myEquipped: EqItem[] = [];
    let myInventoryBySlot: Record<string, EqItem[]> = {};
    if (myGuardianRow) {
      const gid = (myGuardianRow as { id: string }).id;
      const { data: equipRows } = await sb.from("guardian_equipment")
        .select("slot, user_item_id")
        .eq("guardian_id", gid);
      const equippedIds = new Set(((equipRows ?? []) as Array<{ user_item_id: string }>).map((r) => r.user_item_id));
      const slotByEqId = new Map(((equipRows ?? []) as Array<{ slot: string; user_item_id: string }>).map((r) => [r.user_item_id, r.slot]));

      const { data: items } = await sb.from("user_items")
        .select("id, upgrade_tier, item_catalog:item_id(name, emoji, slot, rarity, bonus_hp, bonus_atk, bonus_def, bonus_spd, image_url)")
        .eq("user_id", user.id);

      type ItemRow = { id: string; upgrade_tier: number | null; item_catalog: { name: string; emoji: string; slot: string; rarity: string; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; image_url: string | null } | Array<{ name: string; emoji: string; slot: string; rarity: string; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; image_url: string | null }> };
      const allItems: EqItem[] = ((items ?? []) as ItemRow[]).map((r) => {
        const cat = Array.isArray(r.item_catalog) ? r.item_catalog[0] : r.item_catalog;
        return {
          user_item_id: r.id,
          slot: slotByEqId.get(r.id) ?? cat.slot,
          name: cat.name, emoji: cat.emoji, rarity: cat.rarity,
          upgrade_tier: r.upgrade_tier ?? 0,
          bonus_hp: cat.bonus_hp, bonus_atk: cat.bonus_atk, bonus_def: cat.bonus_def, bonus_spd: cat.bonus_spd,
          image_url: cat.image_url ?? null,
        };
      });
      myEquipped = allItems.filter((it) => equippedIds.has(it.user_item_id));
      myInventoryBySlot = allItems.reduce<Record<string, EqItem[]>>((acc, it) => {
        (acc[it.slot] ??= []).push(it);
        return acc;
      }, {});
    }

    // Base + Effektive Stats (Tier-Multiplier 1.0/1.5/2.25/3.5)
    const TIER_MULT = [1.0, 1.5, 2.25, 3.5];
    const myGuardian = myGuardianRow && arch ? (() => {
      const lvl = (myGuardianRow as { level: number }).level;
      const hpMult  = 1 + (lvl - 1) * 0.06;
      const atkMult = 1 + (lvl - 1) * 0.04;
      const defMult = 1 + (lvl - 1) * 0.04;
      const spdMult = 1 + (lvl - 1) * 0.02;
      const base = {
        hp:  Math.round(arch.base_hp  * hpMult),
        atk: Math.round(arch.base_atk * atkMult),
        def: Math.round(arch.base_def * defMult),
        spd: Math.round(arch.base_spd * spdMult),
      };
      let bHp = 0, bAtk = 0, bDef = 0, bSpd = 0;
      for (const it of myEquipped) {
        const m = TIER_MULT[Math.max(0, Math.min(3, it.upgrade_tier))];
        bHp  += Math.round(it.bonus_hp  * m);
        bAtk += Math.round(it.bonus_atk * m);
        bDef += Math.round(it.bonus_def * m);
        bSpd += Math.round(it.bonus_spd * m);
      }
      return {
        guardian_id: (myGuardianRow as { id: string }).id,
        archetype_id: (myGuardianRow as { archetype_id: string }).archetype_id,
        level:        lvl,
        xp:           (myGuardianRow as { xp: number }).xp,
        wins:         (myGuardianRow as { wins: number }).wins,
        losses:       (myGuardianRow as { losses: number }).losses,
        current_hp_pct: (myGuardianRow as { current_hp_pct: number }).current_hp_pct,
        archetype_name:  arch.name,
        archetype_emoji: arch.emoji,
        rarity:          arch.rarity,
        guardian_type:   arch.guardian_type,
        role:            arch.role,
        base_stats: base,
        bonus_stats: { hp: bHp, atk: bAtk, def: bDef, spd: bSpd },
        effective_stats: { hp: base.hp + bHp, atk: base.atk + bAtk, def: base.def + bDef, spd: base.spd + bSpd },
        equipped: myEquipped,
        inventory_by_slot: myInventoryBySlot,
      };
    })() : null;

    const oppData = (oppRes.data as { ok?: boolean; opponents?: Array<Record<string, unknown>>; error?: string } | null) ?? { ok: true, opponents: [] };
    const realOpponents = oppData.opponents ?? [];

    // Dev-Fallback: mit Bots auf 4 auffüllen
    let opponents = [...realOpponents].slice(0, 4);
    if (opponents.length < 4 && oppData.error !== "no_active_guardian") {
      const { data: myLvlRow } = await sb.from("user_guardians").select("level").eq("user_id", user.id).eq("is_active", true).maybeSingle<{ level: number }>();
      const myLevel = myLvlRow?.level ?? 1;
      const { data: archetypes } = await sb.from("guardian_archetypes")
        .select("id, name, emoji, rarity, guardian_type, role");
      const shuffled = (archetypes ?? []).slice().sort(() => Math.random() - 0.5);
      const botsNeeded = 4 - opponents.length;
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
      my_guardian: myGuardian,
      fights_used_today: fightsUsed,
      gems_spent_today: state?.gems_spent_today ?? 0,
      refresh_used_today: state?.refresh_used_today ?? 0,
      next_gem_cost: nextCost,
      gems_available: gems?.gems ?? 0,
      // 3 gratis Refreshes/Tag, danach 30 💎
      refresh_cost: (state?.refresh_used_today ?? 0) < 3 ? 0 : 30,
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

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BaseClient } from "./base-client";

export const dynamic = "force-dynamic";

export default async function BasePage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/karte/base");

  const { data: profile, error: profileErr } = await sb
    .from("users")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileErr) console.error("[/karte/base] profile error:", profileErr);

  // Base-Level (für Badge auf Avatar)
  const { data: baseRow } = await sb
    .from("bases")
    .select("level, plz")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // Aktive Bau- + Forschungs-Queues für Action-Tile-Badges (Counts)
  // Tabellen-Namen tolerant: kann je nach Migration variieren
  let queueCount = 0;
  let researchCount = 0;
  try {
    const r = await sb.from("research_queue").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
    researchCount = r.count ?? 0;
  } catch { /* table may not exist */ }

  let crew: { id: string; name: string; tag: string | null; color: string | null; role: string } | null = null;
  if (profile?.current_crew_id) {
    const [{ data: c }, { data: m }] = await Promise.all([
      sb.from("crews").select("*").eq("id", profile.current_crew_id).maybeSingle(),
      sb
        .from("crew_members")
        .select("role")
        .eq("crew_id", profile.current_crew_id)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
    ]);
    if (c) {
      const cc = c as { id: string; name: string; tag?: string | null; color?: string | null };
      crew = {
        id: cc.id,
        name: cc.name,
        tag: cc.tag ?? null,
        color: cc.color ?? null,
        role: ((m as { role?: string } | null)?.role) ?? "member",
      };
    }
  }

  const { count: achievementsCount } = await sb
    .from("user_achievements")
    .select("achievement_id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  const { count: achievementsTotal } = await sb
    .from("achievements")
    .select("id", { count: "exact", head: true });

  // Tier-Counts (echt, nicht mehr fake-gesplittet) via RPC
  const { data: tierRow } = await sb
    .rpc("user_achievement_tier_counts", { p_user: auth.user.id })
    .maybeSingle();
  const achievementTiers = {
    bronze: (tierRow as { bronze_count?: number } | null)?.bronze_count ?? 0,
    silver: (tierRow as { silver_count?: number } | null)?.silver_count ?? 0,
    gold:   (tierRow as { gold_count?: number } | null)?.gold_count ?? 0,
  };

  // Heimat-Stadt + aktuelle Ära (für Banner-Display)
  let homeCity: { slug: string; name: string; era_number: number | null; era_started_at: string | null } | null = null;
  const homeSlug = (profile as { home_city_slug?: string | null } | null)?.home_city_slug;
  if (homeSlug) {
    const { data: c } = await sb
      .from("cities")
      .select("slug, name, current_era_id")
      .eq("slug", homeSlug)
      .maybeSingle();
    if (c) {
      const cc = c as { slug: string; name: string; current_era_id: string | null };
      let eraNumber: number | null = null;
      let eraStartedAt: string | null = null;
      if (cc.current_era_id) {
        const { data: e } = await sb
          .from("eras")
          .select("number, started_at")
          .eq("id", cc.current_era_id)
          .maybeSingle();
        const ee = e as { number: number; started_at: string } | null;
        if (ee) { eraNumber = ee.number; eraStartedAt = ee.started_at; }
      }
      homeCity = { slug: cc.slug, name: cc.name, era_number: eraNumber, era_started_at: eraStartedAt };
    }
  }

  return (
    <BaseClient
      profile={profile as Record<string, unknown> | null}
      crew={crew}
      achievementsCount={achievementsCount ?? 0}
      achievementsTotal={achievementsTotal ?? 0}
      achievementTiers={achievementTiers}
      base={baseRow as { level?: number; plz?: string } | null}
      queueCount={queueCount}
      researchCount={researchCount}
      homeCity={homeCity}
    />
  );
}

/**
 * Map-Features (Wave 11-Features):
 * Power-Zones, Boss-Raids, Sanctuaries, Fog-of-War-Cells,
 * Shop-Reviews, Flash-Push-Radius, Shadow-Challenge, Shop-Trail, Loot-Drops.
 *
 * Shared Types + Helpers für Map-Rendering und DB-Queries.
 */

export type PowerZoneKind = "park" | "water" | "city" | "forest" | "landmark";

export type PowerZone = {
  id: string;
  name: string;
  kind: PowerZoneKind;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  buff_hp: number;
  buff_atk: number;
  buff_def: number;
  buff_spd: number;
  color: string;
};

export type BossRaid = {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  max_hp: number;
  current_hp: number;
  starts_at: string;
  ends_at: string;
  reward_loot_rarity: string;
  status: "scheduled" | "active" | "defeated" | "expired";
};

export type Sanctuary = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  emoji: string;
  xp_reward: number;
  trained_today?: boolean;
};

export type ShopReviewAgg = {
  business_id: string;
  avg_rating: number;
  review_count: number;
};

export type FlashPush = {
  id: string;
  business_id: string;
  business_name: string;
  business_lat: number;
  business_lng: number;
  radius_m: number;
  expires_at: string;
  message?: string;
};

export type ShadowRoute = {
  id: string;
  runner_name: string;
  runner_color: string;
  distance_m: number;
  duration_s: number;
  created_at: string;
  geom: Array<{ lat: number; lng: number }>;
};

export type TrailStop = {
  business_id: string;
  name: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
  visit_count: number;
};

export type LootDropMap = {
  id: string;
  lat: number;
  lng: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  spawned_at: number;
  expires_at: number;
  kind: "xp_pack" | "speed_boost" | "mystery_ticket";
};

export const POWER_ZONE_EMOJI: Record<PowerZoneKind, string> = {
  park: "🌳",
  water: "💧",
  city: "🏙️",
  forest: "🌲",
  landmark: "🗿",
};

export const POWER_ZONE_LABEL: Record<PowerZoneKind, string> = {
  park: "Park-Zone",
  water: "Wasser-Zone",
  city: "Stadt-Zone",
  forest: "Wald-Zone",
  landmark: "Wahrzeichen",
};

/** Grid-Cell berechnen (ca. 80m × 80m auf lat 52°) */
export function cellOf(lat: number, lng: number): { x: number; y: number } {
  return { x: Math.floor(lng * 1000), y: Math.floor(lat * 1000) };
}

export function cellToBounds(x: number, y: number): {
  sw: [number, number]; ne: [number, number];
} {
  return { sw: [x / 1000, y / 1000], ne: [(x + 1) / 1000, (y + 1) / 1000] };
}

/** Haversine-Distanz in Metern */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Prüft ob User in einer Power-Zone steht. Gibt aktive Buffs zurück. */
export function activeZoneBuffs(
  userPos: { lat: number; lng: number } | null,
  zones: PowerZone[],
): { zone: PowerZone | null; hp: number; atk: number; def: number; spd: number } {
  if (!userPos) return { zone: null, hp: 0, atk: 0, def: 0, spd: 0 };
  for (const z of zones) {
    const d = haversineM(userPos, { lat: z.center_lat, lng: z.center_lng });
    if (d <= z.radius_m) {
      return { zone: z, hp: z.buff_hp, atk: z.buff_atk, def: z.buff_def, spd: z.buff_spd };
    }
  }
  return { zone: null, hp: 0, atk: 0, def: 0, spd: 0 };
}

/** Demo Shadow-Route (für Runner ohne Crew-Kumpel-Daten) */
export function demoShadowRoute(center: { lat: number; lng: number }): ShadowRoute {
  const pts: Array<{ lat: number; lng: number }> = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const angle = t * Math.PI * 2;
    const r = 0.003 + 0.001 * Math.sin(t * 8);
    pts.push({
      lat: center.lat + r * Math.cos(angle),
      lng: center.lng + r * Math.sin(angle) * 1.5,
    });
  }
  return {
    id: "demo-shadow",
    runner_name: "Stadtfuchs_87",
    runner_color: "#a855f7",
    distance_m: 3200,
    duration_s: 1680,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    geom: pts,
  };
}

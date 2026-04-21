// Liefert aggregierte Power-Zone-Buffs für eine gegebene GPS-Position.
// Alle Zonen, in denen der Punkt liegt, werden aufsummiert.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PowerZoneBuff = { hp: number; atk: number; def: number; spd: number; zones: string[] };

const EMPTY: PowerZoneBuff = { hp: 0, atk: 0, def: 0, spd: 0, zones: [] };

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPowerZoneBuffs(sb: SupabaseClient<any, any, any>, lat: number | null | undefined, lng: number | null | undefined): Promise<PowerZoneBuff> {
  if (typeof lat !== "number" || typeof lng !== "number") return { ...EMPTY };
  const { data } = await sb.from("power_zones")
    .select("name, center_lat, center_lng, radius_m, buff_hp, buff_atk, buff_def, buff_spd");
  if (!data) return { ...EMPTY };

  const agg: PowerZoneBuff = { hp: 0, atk: 0, def: 0, spd: 0, zones: [] };
  for (const z of data as Array<{ name: string; center_lat: number; center_lng: number; radius_m: number; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number }>) {
    const d = haversineM(lat, lng, z.center_lat, z.center_lng);
    if (d <= z.radius_m) {
      agg.hp  += z.buff_hp  ?? 0;
      agg.atk += z.buff_atk ?? 0;
      agg.def += z.buff_def ?? 0;
      agg.spd += z.buff_spd ?? 0;
      agg.zones.push(z.name);
    }
  }
  return agg;
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Art = { image_url: string | null; video_url: string | null };
type MarkerArt = Record<string, Record<string, Art>>; // slot_id -> variant -> Art

export async function GET() {
  const sb = await createClient();
  const { data } = await sb.from("cosmetic_artwork").select("kind, slot_id, variant, image_url, video_url");

  // Marker ist jetzt geschachtelt: marker[slot_id][variant] = {image_url, video_url}
  // Light + pin_theme bleiben flach, lesen Variant='neutral'
  const marker: MarkerArt = {};
  const light:     Record<string, Art> = {};
  const pin_theme: Record<string, Art> = {};
  const siegel:    Record<string, Art> = {};
  const potion:    Record<string, Art> = {};
  const rank:      Record<string, Art> = {};
  const base_theme: Record<string, Art> = {};
  const building:   Record<string, Art> = {};
  const resource:   Record<string, Art> = {};
  const chest:      Record<string, Art> = {};
  for (const r of (data ?? []) as Array<{ kind: string; slot_id: string; variant: string; image_url: string | null; video_url: string | null }>) {
    const art: Art = { image_url: r.image_url, video_url: r.video_url };
    if (r.kind === "marker") {
      if (!marker[r.slot_id]) marker[r.slot_id] = {};
      marker[r.slot_id][r.variant] = art;
    } else if (r.kind === "light") {
      light[r.slot_id] = art;
    } else if (r.kind === "pin_theme") {
      pin_theme[r.slot_id] = art;
    } else if (r.kind === "siegel") {
      siegel[r.slot_id] = art;
    } else if (r.kind === "potion") {
      potion[r.slot_id] = art;
    } else if (r.kind === "rank") {
      rank[r.slot_id] = art;
    } else if (r.kind === "base_theme") {
      base_theme[r.slot_id] = art;
    } else if (r.kind === "building") {
      building[r.slot_id] = art;
    } else if (r.kind === "resource") {
      resource[r.slot_id] = art;
    } else if (r.kind === "chest") {
      chest[r.slot_id] = art;
    }
  }
  return NextResponse.json({ marker, light, pin_theme, siegel, potion, rank, base_theme, building, resource, chest });
}

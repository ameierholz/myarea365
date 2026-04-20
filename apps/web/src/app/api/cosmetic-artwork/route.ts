import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data } = await sb.from("cosmetic_artwork").select("kind, slot_id, image_url, video_url");
  const marker:    Record<string, { image_url: string | null; video_url: string | null }> = {};
  const light:     Record<string, { image_url: string | null; video_url: string | null }> = {};
  const pin_theme: Record<string, { image_url: string | null; video_url: string | null }> = {};
  for (const r of (data ?? []) as Array<{ kind: string; slot_id: string; image_url: string | null; video_url: string | null }>) {
    const bucket = r.kind === "marker" ? marker : r.kind === "light" ? light : r.kind === "pin_theme" ? pin_theme : null;
    if (bucket) bucket[r.slot_id] = { image_url: r.image_url, video_url: r.video_url };
  }
  return NextResponse.json({ marker, light, pin_theme });
}

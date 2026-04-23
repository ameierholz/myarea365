import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = {
  shop_id: string;
  name?: string;
  category?: string;
  description?: string;
  address?: string;
  street?: string;
  zip?: string;
  city?: string;
  state?: string;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  logo_url?: string | null;
  cover_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  opening_hours?: unknown;
  paused?: boolean;
};

/**
 * PATCH /api/shop/profile
 * Owner ändert eigene Shop-Daten. RLS erzwingt Owner-Check.
 */
export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as Patch;
  if (!body.shop_id) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const str = (v: unknown) => typeof v === "string" ? v.trim() : undefined;
  const opt = (v: unknown) => v === null ? null : (typeof v === "string" ? v.trim() : undefined);

  if (str(body.name))          patch.name = str(body.name);
  if (str(body.category))      patch.category = str(body.category);
  if (opt(body.description) !== undefined) patch.description = opt(body.description) || null;
  if (str(body.city))          patch.city = str(body.city);
  if (str(body.state))         patch.state = str(body.state);
  if (str(body.country))       patch.country = str(body.country)!.toUpperCase().slice(0, 2);
  if (str(body.contact_email)) patch.contact_email = str(body.contact_email);
  if (opt(body.contact_phone) !== undefined) patch.contact_phone = opt(body.contact_phone) || null;
  if (opt(body.website) !== undefined) patch.website = opt(body.website) || null;
  if (body.logo_url === null || str(body.logo_url)) patch.logo_url = body.logo_url === null ? null : str(body.logo_url);
  if (body.cover_url === null || str(body.cover_url)) patch.cover_url = body.cover_url === null ? null : str(body.cover_url);

  // Address aus street/zip/city zusammensetzen, wenn mitgeliefert
  if (body.street || body.zip || body.city) {
    const street = str(body.street) ?? "";
    const zip    = str(body.zip) ?? "";
    const city   = str(body.city) ?? "";
    patch.address = [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (str(body.zip)) patch.zip = str(body.zip);
  } else if (str(body.address)) {
    patch.address = str(body.address);
  }

  // GPS-Koordinaten
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    patch.location = `POINT(${body.lng} ${body.lat})`;
  }

  // Öffnungszeiten als JSONB (Array von 7 Einträgen erwartet)
  if (Array.isArray(body.opening_hours)) {
    patch.opening_hours = body.opening_hours;
  }

  // Pause-Toggle
  if (typeof body.paused === "boolean") {
    patch.paused_at = body.paused ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await sb.from("local_businesses")
    .update(patch)
    .eq("id", body.shop_id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plz/waitlist — Trägt den User auf die Warteliste für seine PLZ ein.
 * Wird sowohl von eingeloggten Usern (mit user_id) als auch von Sign-Up-Visitors
 * (mit email statt user_id) genutzt.
 *
 * Body: {
 *   plz: string,                    // 5-stellig
 *   email?: string,                 // bei nicht-eingeloggten
 *   fallback_city_slug?: string,    // welche Stadt der User temporär gewählt hat
 *   source?: string,                // "register", "settings_change", etc.
 * }
 */
export async function POST(req: NextRequest) {
  type Body = {
    plz?: string; email?: string;
    fallback_city_slug?: string; source?: string;
  };
  const body = (await req.json().catch(() => ({}))) as Body;
  const plz = (body.plz ?? "").trim();
  if (!/^[0-9]{5}$/.test(plz)) {
    return NextResponse.json({ error: "invalid_plz" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Email muss vorhanden sein wenn kein User-Login (sonst kein Kontakt-Weg)
  if (!userId && !body.email) {
    return NextResponse.json({ error: "email_required_for_anonymous" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("plz_waitlist")
    .insert({
      plz,
      user_id: userId,
      email: body.email ?? auth?.user?.email ?? null,
      fallback_city_slug: body.fallback_city_slug ?? null,
      source: body.source ?? "register",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}

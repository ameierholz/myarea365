import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name: string;
  category: string;
  street: string;
  zip: string;
  city: string;
  state?: string;
  country?: string;
  contact_email: string;
  contact_phone?: string;
  description?: string;
  website?: string;
};

/**
 * POST /api/shop/register
 * Öffentliche Shop-Einreichung. Erstellt einen neuen local_businesses-Eintrag
 * mit status='pending'. User muss eingeloggt sein (owner_id = auth.uid()).
 * Admin moderiert in /admin/shops.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });

  const body = await req.json() as Body;
  const required: Array<keyof Body> = ["name", "category", "street", "zip", "city", "contact_email"];
  for (const k of required) {
    if (!body[k] || String(body[k]).trim().length < 2) {
      return NextResponse.json({ ok: false, error: `missing_${k}` }, { status: 400 });
    }
  }
  if (!/^\S+@\S+\.\S+$/.test(body.contact_email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!/^\d{4,5}$/.test(body.zip.trim())) {
    return NextResponse.json({ ok: false, error: "invalid_zip" }, { status: 400 });
  }

  const slug = body.name.toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) + "-" + Math.random().toString(36).slice(2, 7);

  const country = (body.country ?? "DE").trim().toUpperCase().slice(0, 2);
  const { data, error } = await sb.from("local_businesses").insert({
    owner_id: user.id,
    name: body.name.trim(),
    slug,
    category: body.category.trim(),
    address: `${body.street.trim()}, ${body.zip.trim()} ${body.city.trim()}`,
    city: body.city.trim(),
    zip: body.zip.trim(),
    state: body.state?.trim() || null,
    country,
    contact_email: body.contact_email.trim(),
    contact_phone: body.contact_phone?.trim() || null,
    description: body.description?.trim() || null,
    website: body.website?.trim() || null,
    status: "pending",
    submitted_at: new Date().toISOString(),
    plan: "free",
    active: false,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, shop_id: data.id });
}

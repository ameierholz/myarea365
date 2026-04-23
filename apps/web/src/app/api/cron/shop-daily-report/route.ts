import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendMail, renderLayout } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel-Cron 08:00 UTC: schickt Tages-Report an alle Shop-Owner, die
 * email_daily_report=true gesetzt haben, mit den Einlöse-Zahlen der
 * letzten 24 h.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });
  const sb = createAdminClient(url, key, { auth: { persistSession: false } });

  // Alle Shops mit opted-in Daily-Report laden
  const { data: prefs } = await sb.from("shop_notification_prefs")
    .select("shop_id, email_daily_report")
    .eq("email_daily_report", true);

  const shopIds = (prefs ?? []).map((p) => (p as { shop_id: string }).shop_id);
  if (shopIds.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "no_opted_in_shops" });

  const { data: shops } = await sb.from("local_businesses")
    .select("id, name, contact_email, owner_id")
    .in("id", shopIds)
    .eq("status", "approved");

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  let sent = 0;
  for (const s of shops ?? []) {
    const shop = s as { id: string; name: string; contact_email: string | null; owner_id: string };
    if (!shop.contact_email) continue;

    // Zahlen der letzten 24h
    const { count: redemptions } = await sb.from("deal_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("business_id", shop.id)
      .eq("status", "verified")
      .gte("created_at", since);

    // Skip, wenn nichts passiert ist — keine leeren Mails verschicken
    if (!redemptions || redemptions === 0) continue;

    const html = renderLayout({
      preheader: `${redemptions} Einlösungen bei ${shop.name} in den letzten 24h`,
      title: `Dein Tages-Report: ${shop.name}`,
      bodyHtml: `
        <p>In den letzten 24 Stunden haben <b>${redemptions}</b> Runner bei dir eingelöst.</p>
        <p>Zeit, kurz ins Dashboard zu schauen? Dort siehst du Top-Zeiten, Wiederkehr-Rate und deine aktivsten Crews.</p>
      `,
      cta: { label: "Dashboard öffnen", url: "https://myarea365.de/shop-dashboard" },
    });

    const result = await sendMail({
      to: shop.contact_email,
      subject: `📊 ${redemptions} Einlösungen heute — ${shop.name}`,
      html,
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: (shops ?? []).length });
}

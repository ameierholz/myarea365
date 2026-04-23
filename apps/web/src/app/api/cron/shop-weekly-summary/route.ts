import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendMail, renderLayout } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel-Cron (Montag 08:00 UTC): Wochen-Summary an alle Shop-Owner, die
 * email_weekly_summary=true haben. Zeigt Einlösungen, Top-Crew, Trend.
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

  const { data: prefs } = await sb.from("shop_notification_prefs")
    .select("shop_id")
    .eq("email_weekly_summary", true);
  const shopIds = (prefs ?? []).map((p) => (p as { shop_id: string }).shop_id);
  if (shopIds.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "no_opted_in_shops" });

  const { data: shops } = await sb.from("local_businesses")
    .select("id, name, contact_email")
    .in("id", shopIds)
    .eq("status", "approved");

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const prevSince = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  let sent = 0;
  for (const s of shops ?? []) {
    const shop = s as { id: string; name: string; contact_email: string | null };
    if (!shop.contact_email) continue;

    const [currentRes, prevRes, topCrewRes] = await Promise.all([
      sb.from("deal_redemptions").select("*", { count: "exact", head: true })
        .eq("business_id", shop.id).eq("status", "verified").gte("created_at", since),
      sb.from("deal_redemptions").select("*", { count: "exact", head: true })
        .eq("business_id", shop.id).eq("status", "verified")
        .gte("created_at", prevSince).lt("created_at", since),
      sb.from("crew_shop_stamps").select("stamp_count, crews(name)")
        .eq("shop_id", shop.id).order("stamp_count", { ascending: false }).limit(1),
    ]);

    const currentWeek = currentRes.count ?? 0;
    const prevWeek = prevRes.count ?? 0;
    if (currentWeek === 0) continue;

    const diff = currentWeek - prevWeek;
    const trend = diff === 0 ? "stabil" : diff > 0 ? `+${diff} (${Math.round((diff / Math.max(1, prevWeek)) * 100)} %)` : `${diff} (${Math.round((diff / Math.max(1, prevWeek)) * 100)} %)`;
    const topCrew = (topCrewRes.data?.[0] as unknown as { crews?: { name?: string } | null; stamp_count: number } | undefined);
    const topCrewName = topCrew?.crews?.name;
    const topCrewCount = topCrew?.stamp_count ?? 0;

    const html = renderLayout({
      preheader: `Wochen-Summary: ${currentWeek} Einlösungen bei ${shop.name}`,
      title: `Deine Woche bei ${shop.name}`,
      bodyHtml: `
        <p><b>${currentWeek}</b> Einlösungen in den letzten 7 Tagen · Trend: <b>${trend}</b> ggü. Vorwoche</p>
        ${topCrewName ? `<p>🏆 Top-Crew: <b>${topCrewName}</b> mit <b>${topCrewCount}</b> Stempeln</p>` : ""}
        <p>Im Dashboard findest du Top-Zeiten, Wiederkehr-Rate und die Performance deiner Deals.</p>
      `,
      cta: { label: "Details im Dashboard", url: "https://myarea365.de/shop-dashboard" },
    });

    const result = await sendMail({
      to: shop.contact_email,
      subject: `📈 Wochen-Summary: ${currentWeek} Einlösungen — ${shop.name}`,
      html,
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: (shops ?? []).length });
}

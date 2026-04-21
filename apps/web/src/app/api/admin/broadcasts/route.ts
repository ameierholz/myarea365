import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Segment = {
  faction?: "syndicate" | "vanguard" | null;
  country?: string | null;
  city?: string | null;
  inactive_days?: number | null;   // Runner ohne Walk seit X Tagen
  min_level?: number | null;
  crew_id?: string | null;
};

async function resolveSegment(sb: Awaited<ReturnType<typeof createClient>>, seg: Segment): Promise<string[]> {
  let q = sb.from("users").select("id, last_seen_at, level, faction, current_crew_id, country, city");
  if (seg.faction)  q = q.eq("faction", seg.faction);
  if (seg.country)  q = q.eq("country", seg.country);
  if (seg.city)     q = q.eq("city", seg.city);
  if (seg.crew_id)  q = q.eq("current_crew_id", seg.crew_id);
  if (seg.min_level)q = q.gte("level", seg.min_level);

  const { data } = await q.limit(50_000);
  let rows = (data ?? []) as Array<{ id: string; last_seen_at: string | null }>;

  if (seg.inactive_days && seg.inactive_days > 0) {
    const cutoff = Date.now() - seg.inactive_days * 86_400_000;
    rows = rows.filter((r) => !r.last_seen_at || new Date(r.last_seen_at).getTime() < cutoff);
  }
  return rows.map((r) => r.id);
}

export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);

  if (url.searchParams.get("preview") === "1") {
    const segRaw = url.searchParams.get("segment") ?? "{}";
    const seg = JSON.parse(segRaw) as Segment;
    const ids = await resolveSegment(sb, seg);
    return NextResponse.json({ ok: true, count: ids.length });
  }

  const { data } = await sb.from("admin_broadcasts")
    .select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, broadcasts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId, email } = await requireStaff();
  const sb = await createClient();
  const body = await req.json() as {
    title: string; body: string;
    channel: "inapp" | "push" | "email";
    segment: Segment;
    dry_run?: boolean;
  };
  if (!body.title || !body.body) return NextResponse.json({ ok: false, error: "title/body fehlt" }, { status: 400 });

  const ids = await resolveSegment(sb, body.segment);

  const { data: broadcast, error } = await sb.from("admin_broadcasts").insert({
    title: body.title,
    body: body.body,
    channel: body.channel ?? "inapp",
    segment: body.segment,
    recipient_count: ids.length,
    recipient_sample: ids.slice(0, 50),
    sent_by: userId,
    sent_by_email: email,
    status: body.dry_run ? "pending" : "sent",
    sent_at: body.dry_run ? null : new Date().toISOString(),
  }).select("id").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // In-App: Inbox-Einträge für alle Empfänger anlegen
  if (!body.dry_run && body.channel === "inapp" && ids.length > 0) {
    const inboxRows = ids.map((uid) => ({
      user_id: uid,
      broadcast_id: (broadcast as { id: string }).id,
      title: body.title,
      body: body.body,
    }));
    // Batch insert in 1000er-Blöcken
    for (let i = 0; i < inboxRows.length; i += 1000) {
      await sb.from("user_inbox").insert(inboxRows.slice(i, i + 1000));
    }
  }
  // Push/Email: Stub — hier würde die externe Integration (FCM/SES) getriggert.

  return NextResponse.json({
    ok: true,
    broadcast_id: (broadcast as { id: string }).id,
    recipient_count: ids.length,
    dry_run: !!body.dry_run,
  });
}

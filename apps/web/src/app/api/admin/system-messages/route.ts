import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  await requireAdmin();
  const sb = await createClient();
  const { data, error } = await sb.from("system_message_templates")
    .select("*").order("kind");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function PUT(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null) as {
    kind?: string;
    title?: string; body?: string;
    emoji?: string; color?: string; hero_label?: string;
    category?: string;
    default_reward?: Record<string, unknown>;
    active?: boolean;
  } | null;
  if (!body?.kind) return NextResponse.json({ error: "missing_kind" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["title", "body", "emoji", "color", "hero_label", "category", "default_reward", "active"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  const { data, error } = await adminSb().from("system_message_templates")
    .update(update).eq("kind", body.kind).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null) as { kind?: string; vars?: Record<string, string> } | null;
  if (!body?.kind) return NextResponse.json({ error: "missing_kind" }, { status: 400 });

  const sb = await createClient();
  const { data: tpl, error } = await sb.from("system_message_templates")
    .select("title, body, emoji, color, hero_label, default_reward")
    .eq("kind", body.kind).single();
  if (error || !tpl) return NextResponse.json({ error: error?.message ?? "template_not_found" }, { status: 404 });

  const vars = {
    runner_name: "Kaelthor", crew_name: "Kaelthors Kiez-Crew",
    gems: "100", wood: "1000", stone: "750", gold: "1000", mana: "500",
    item_name: "Goldene Truhe", item_count: "2",
    chest_kind: "Eroberer", set_name: "Wächter-Chroniken",
    sender_name: "Aurelius", level: "3", points: "200", sku: "mpack_small",
    survey_title: "Erste Eindrücke", guardian_name: "Khael Sturmflügel",
    offer_name: "Erstläufer-Paket", kind: "google", emoji: "🔐", label: "Google verknüpft",
    ...(body.vars ?? {}),
  };

  const fmt = (s: string) => Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)), s
  );
  return NextResponse.json({
    title: fmt(tpl.title),
    body: fmt(tpl.body),
    emoji: tpl.emoji, color: tpl.color, hero_label: tpl.hero_label,
    default_reward: tpl.default_reward,
  });
}

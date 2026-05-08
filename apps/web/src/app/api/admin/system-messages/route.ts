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
    .select("*").order("kind").order("locale");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function PUT(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null) as {
    kind?: string;
    locale?: string;
    title?: string; body?: string;
    emoji?: string; color?: string; hero_label?: string;
    category?: string;
    default_reward?: Record<string, unknown>;
    active?: boolean;
  } | null;
  if (!body?.kind) return NextResponse.json({ error: "missing_kind" }, { status: 400 });
  const locale = (body.locale || "de").toLowerCase().split("-")[0];

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["title", "body", "emoji", "color", "hero_label", "category", "default_reward", "active"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  const sbAdmin = adminSb();
  const { data: existing } = await sbAdmin
    .from("system_message_templates")
    .select("kind,locale")
    .eq("kind", body.kind).eq("locale", locale).maybeSingle();

  if (existing) {
    const { data, error } = await sbAdmin.from("system_message_templates")
      .update(update).eq("kind", body.kind).eq("locale", locale).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, template: data });
  }

  // Neue Locale-Variante anlegen — Defaults aus DE übernehmen damit NOT-NULL-Spalten gefüllt sind
  const { data: deTpl } = await sbAdmin.from("system_message_templates")
    .select("*").eq("kind", body.kind).eq("locale", "de").maybeSingle();
  const baseRow = (deTpl ?? {}) as Record<string, unknown>;
  const insertRow: Record<string, unknown> = {
    ...baseRow,
    kind: body.kind, locale,
    ...update,
    title: body.title ?? baseRow.title ?? "",
    body: body.body ?? baseRow.body ?? "",
  };
  delete insertRow.created_at;
  const { data, error } = await sbAdmin.from("system_message_templates")
    .insert(insertRow).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null) as { kind?: string; locale?: string; vars?: Record<string, string> } | null;
  if (!body?.kind) return NextResponse.json({ error: "missing_kind" }, { status: 400 });
  const locale = (body.locale || "de").toLowerCase().split("-")[0];

  const sb = await createClient();
  let { data: tpl, error } = await sb.from("system_message_templates")
    .select("title, body, emoji, color, hero_label, default_reward")
    .eq("kind", body.kind).eq("locale", locale).maybeSingle();
  if (!tpl) {
    const fb = await sb.from("system_message_templates")
      .select("title, body, emoji, color, hero_label, default_reward")
      .eq("kind", body.kind).eq("locale", "de").single();
    tpl = fb.data; error = fb.error;
  }
  if (error || !tpl) return NextResponse.json({ error: error?.message ?? "template_not_found" }, { status: 404 });

  const vars = {
    runner_name: "Kaelthor", crew_name: "Kaelthors Kiez-Crew",
    gems: "100", wood: "1000", stone: "750", gold: "1000", mana: "500",
    item_name: "Goldene Truhe", item_count: "2",
    chest_kind: "Eroberer", set_name: "Begleiter-Chroniken",
    sender_name: "Aurelius", level: "3", points: "200", sku: "mpack_small",
    survey_title: "Erste Eindrücke", guardian_name: "Khael Sturmflügel",
    offer_name: "Erstläufer-Paket", kind: "google", emoji: "🔐", label: "Google verknüpft",
    target_name: "Zielspieler", troops_sent: "2.500", troops_lost: "180", enemy_lost: "1.420",
    loot_summary: "12.000 Krypto · 3.500 Komponenten",
    enemy_power: "458.000", enemy_resources: "23k Krypto · 18k Schrott", wall_level: "12",
    leader_name: "Anführer", participant_count: "5", loot_per_member: "2.400 Krypto",
    resource_emoji: "💸", collected: "12.500", resource_label: "Krypto",
    troop_count: "1.000", kind_label: "ATM/Bank", node_level: "8",
    duration_min: "12", distance_km: "1.4", node_name: "Sparkasse Mitte",
    location_name: "Senftenberger Ring", founder_name: "Kaelthor",
    attacker_name: "Banditenanführer", attacker_crew: "[ROT]", remaining_hp: "67%",
    title: "Stadtfürst", user_name: "Kaelthor", city_name: "Berlin",
    buff_description: "+5% Krypto-Produktion für die ganze Stadt",
    description: "Eine seltene Auszeichnung für besondere Verdienste.",
    nl: "\n",
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

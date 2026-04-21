import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "open";

  let q = sb.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter === "open")         q = q.eq("status", "open");
  else if (filter === "in_progress") q = q.eq("status", "in_progress");
  else if (filter === "resolved") q = q.eq("status", "resolved");

  const { data } = await q;
  return NextResponse.json({ ok: true, tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const body = await req.json() as { action: "update"; id: string; patch: Record<string, unknown> };

  if (body.action === "update") {
    const { error } = await sb.from("support_tickets")
      .update({ ...body.patch, updated_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

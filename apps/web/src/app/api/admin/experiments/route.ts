import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaff();
  const sb = await createClient();
  const { data: exps } = await sb.from("experiments").select("*").order("created_at", { ascending: false });

  // Assignment-Counts
  const ids = (exps ?? []).map((e) => (e as { id: string }).id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: as } = await sb.from("experiment_assignments").select("experiment_id").in("experiment_id", ids);
    for (const a of as ?? []) counts.set((a as { experiment_id: string }).experiment_id, (counts.get((a as { experiment_id: string }).experiment_id) ?? 0) + 1);
  }

  const items = (exps ?? []).map((e) => ({
    ...(e as Record<string, unknown>),
    assignments: counts.get((e as { id: string }).id) ?? 0,
  }));
  return NextResponse.json({ ok: true, experiments: items });
}

export async function POST(req: NextRequest) {
  const { userId } = await requireStaff();
  const sb = await createClient();
  const body = await req.json() as
    | { action: "create"; key: string; description?: string; variants: Array<{ key: string; weight: number }> }
    | { action: "set_status"; id: string; status: "draft" | "running" | "paused" | "completed" };

  if (body.action === "create") {
    if (!body.key || !body.variants?.length) return NextResponse.json({ ok: false, error: "key/variants fehlt" }, { status: 400 });
    const { error } = await sb.from("experiments").insert({
      key: body.key, description: body.description ?? null,
      variants: body.variants, status: "draft", created_by: userId,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_status") {
    const patch: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
    if (body.status === "running")   patch.started_at = new Date().toISOString();
    if (body.status === "completed") patch.ended_at   = new Date().toISOString();
    const { error } = await sb.from("experiments").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

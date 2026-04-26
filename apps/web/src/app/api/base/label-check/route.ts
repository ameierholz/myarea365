import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/label-check?label=Name → { ok, available, error? } */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const label = url.searchParams.get("label") ?? "";
  const { data, error } = await sb.rpc("check_base_label_available", { p_label: label });
  if (error) return NextResponse.json({ ok: false, error: error.message });
  return NextResponse.json(data);
}

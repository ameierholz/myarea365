import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "../_components/ui";
import { BannersClient } from "./banners-client";

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  await requireAdmin();
  const sb = await createClient();
  const { data: rows } = await sb.from("in_app_banners")
    .select("id, title, body, cta_label, cta_href, target, starts_at, ends_at, dismissible, active, background_color, text_color, priority, created_at")
    .order("priority", { ascending: false }).order("created_at", { ascending: false });

  return (
    <>
      <PageTitle title="📢 In-App-Banner" subtitle="Promo-Banner im Frontend planen, segmentieren, A/B-testen" />
      <BannersClient initial={(rows ?? []) as BannerRow[]} />
    </>
  );
}

export type BannerRow = {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  target: string;
  starts_at: string;
  ends_at: string | null;
  dismissible: boolean;
  active: boolean;
  background_color: string | null;
  text_color: string | null;
  priority: number;
  created_at: string;
};

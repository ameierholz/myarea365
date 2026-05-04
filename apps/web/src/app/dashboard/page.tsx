import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getLocale, getTranslations } from "next-intl/server";
import { buildSeoMetadata } from "@/lib/seo-meta";
import type { Locale } from "@/i18n/config";
import { MapLoader } from "./map-loader";

const MapDashboard = dynamic(
  () => import("./map-dashboard").then((m) => ({ default: m.MapDashboard })),
  {
    loading: () => <MapLoader />,
  },
);

export async function generateMetadata() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("MapDashboard");
  return buildSeoMetadata({
    path: "dashboard",
    title: "Dashboard · MyArea365",
    description: t.has("metaDescription") ? t("metaDescription") : "Erlauf dir die Stadt — gemeinsam in Bewegung. Map-Tracking, Crews und Wettkampf live.",
    locale,
    index: false, // Authenticated-only
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return <MapDashboard profile={profile} />;
}

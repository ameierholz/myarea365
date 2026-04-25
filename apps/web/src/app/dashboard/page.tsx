import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { MapLoader } from "./map-loader";

const MapDashboard = dynamic(
  () => import("./map-dashboard").then((m) => ({ default: m.MapDashboard })),
  {
    loading: () => <MapLoader />,
  },
);

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

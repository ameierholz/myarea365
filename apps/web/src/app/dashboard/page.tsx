import { createClient } from "@/lib/supabase/server";
import { MapDashboard } from "./map-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user!.id)
    .single();

  return <MapDashboard profile={profile} />;
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy-load: map-dashboard ist ~12k Zeilen + mapbox-gl (~220 KB gz).
// Kein SSR, weil mapbox-gl nur im Browser läuft.
const MapDashboard = dynamic(
  () => import("./map-dashboard").then((m) => ({ default: m.MapDashboard })),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-bg-deep text-text-muted">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🗺️</div>
          <div className="text-sm font-bold">Karte wird geladen…</div>
        </div>
      </div>
    ),
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

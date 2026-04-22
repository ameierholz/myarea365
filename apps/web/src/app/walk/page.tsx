import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WalkClient } from "./walk-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Walk aufzeichnen",
  description: "Starte deinen Walk und erobere neue Straßen.",
};

export default async function WalkPage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/walk");

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#F0F0F0]">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black">🏃 Walk</h1>
          <a href="/dashboard" className="text-xs text-[#22D1C3] hover:underline">
            ← Dashboard
          </a>
        </div>
        <WalkClient />
      </div>
    </main>
  );
}

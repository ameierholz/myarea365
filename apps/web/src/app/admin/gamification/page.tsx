import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card } from "../_components/ui";
import { GamificationEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function GamificationPage() {
  const sb = await createClient();
  const { data: config } = await sb.from("gamification_config").select("*").order("key");

  return (
    <>
      <PageTitle title="🏆 Gamification-Tuning" subtitle="Live-editierbare Konstanten (XP, Saisons, Limits)" />
      <Card>
        <GamificationEditor entries={config ?? []} />
      </Card>
    </>
  );
}

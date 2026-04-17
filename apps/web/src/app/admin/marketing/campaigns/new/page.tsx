import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card } from "../../../_components/ui";
import { CampaignForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const sb = await createClient();
  const { data: segments } = await sb.from("user_segments").select("*").order("name");

  return (
    <>
      <PageTitle title="📬 Neue Kampagne" subtitle="Newsletter an ein Segment versenden" />
      <Card>
        <CampaignForm segments={segments ?? []} />
      </Card>
    </>
  );
}

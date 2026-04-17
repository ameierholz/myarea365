import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card } from "../_components/ui";
import { FlagsEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const sb = await createClient();
  const { data: flags } = await sb.from("feature_flags").select("*").order("key");
  return (
    <>
      <PageTitle title="🚩 Feature-Flags" subtitle="Features per Toggle aktivieren/deaktivieren" />
      <Card><FlagsEditor flags={flags ?? []} /></Card>
    </>
  );
}

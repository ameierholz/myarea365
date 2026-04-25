import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CrewBaseClient } from "./crew-base-client";

export const dynamic = "force-dynamic";

export default async function CrewBasePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return <CrewBaseClient />;
}

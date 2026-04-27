import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Posteingang" };

export default async function InboxPage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/inbox");

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#F0F0F0]">
      <InboxClient />
    </main>
  );
}

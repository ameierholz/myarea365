import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/inbox");

  const { data: messages } = await sb
    .from("user_inbox")
    .select("id, title, body, read_at, created_at, broadcast_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#F0F0F0]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">📬 Posteingang</h1>
            <p className="text-xs text-[#8B8FA3] mt-1">
              Benachrichtigungen vom MyArea365-Team
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-xs text-[#22D1C3] hover:underline"
          >
            ← Dashboard
          </a>
        </div>

        <InboxClient initial={messages ?? []} />
      </div>
    </main>
  );
}

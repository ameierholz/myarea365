import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PurchaseStatusBanner } from "@/components/purchase-status-banner";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      <PurchaseStatusBanner />
      {children}
      <ChatWidget currentUserId={user.id} />
    </>
  );
}

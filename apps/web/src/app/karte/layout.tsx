import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PurchaseStatusBanner } from "@/components/purchase-status-banner";
import { ChatWidgetLazy } from "@/components/chat/chat-widget-lazy";
import { SplashGate } from "./_components/splash-gate";
import { RewardFxProvider } from "@/components/reward-fx";

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
    <RewardFxProvider>
      <SplashGate>
        <PurchaseStatusBanner />
        {children}
        <ChatWidgetLazy currentUserId={user.id} />
      </SplashGate>
    </RewardFxProvider>
  );
}

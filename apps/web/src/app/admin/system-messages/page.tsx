import { requireAdmin } from "@/lib/admin";
import { SystemMessagesClient } from "./system-messages-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "System-Nachrichten · Admin" };

export default async function SystemMessagesPage() {
  await requireAdmin();
  return <SystemMessagesClient />;
}

import { requireAdmin } from "@/lib/admin";
import { InboxGiftsClient } from "./inbox-gifts-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox-Geschenke · Admin" };

export default async function InboxGiftsPage() {
  await requireAdmin();
  return <InboxGiftsClient />;
}

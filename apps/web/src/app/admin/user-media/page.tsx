import { requireAdmin } from "@/lib/admin";
import { UserMediaClient } from "./user-media-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "User-Media · Admin" };

export default async function UserMediaPage() {
  await requireAdmin();
  return <UserMediaClient />;
}

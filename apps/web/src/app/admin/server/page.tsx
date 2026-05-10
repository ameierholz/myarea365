import { requireStaff } from "@/lib/admin";
import { ServerAdminClient } from "./server-admin-client";

export const dynamic = "force-dynamic";

export default async function ServerAdminPage() {
  await requireStaff();
  return <ServerAdminClient />;
}

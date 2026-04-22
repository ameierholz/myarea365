import { requireStaff } from "@/lib/admin";
import { MissionsClient } from "./missions-client";

export const metadata = { title: "Missionen · Admin · MyArea365" };
export const dynamic = "force-dynamic";

export default async function MissionsAdminPage() {
  await requireStaff();
  return <MissionsClient />;
}

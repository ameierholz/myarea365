import { requireAdmin } from "@/lib/admin";
import { ArtworkAdminClient } from "./artwork-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artwork · Admin" };

export default async function ArtworkAdminPage() {
  await requireAdmin();
  return <ArtworkAdminClient />;
}

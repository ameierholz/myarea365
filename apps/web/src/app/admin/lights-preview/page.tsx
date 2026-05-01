import { requireAdmin } from "@/lib/admin";
import { LightsPreviewClient } from "./lights-preview-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lights & Märsche Preview · Admin" };

export default async function LightsPreviewPage() {
  await requireAdmin();
  return <LightsPreviewClient />;
}

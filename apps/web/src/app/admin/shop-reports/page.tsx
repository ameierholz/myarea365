import { requireStaff } from "@/lib/admin";
import { ShopReportsClient } from "./shop-reports-client";

export const metadata = { title: "Shop-Reports · Admin · MyArea365" };
export const dynamic = "force-dynamic";

export default async function ShopReportsPage() {
  await requireStaff();
  return <ShopReportsClient />;
}

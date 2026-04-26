import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Base wird jetzt als Pin auf der Dashboard-Karte gerendert.
// Click auf den Pin öffnet das BaseModal mit Resourcen/Bau/Truhen/VIP.
export default function BasePage() {
  redirect("/dashboard");
}

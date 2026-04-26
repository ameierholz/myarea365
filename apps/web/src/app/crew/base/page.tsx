import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Crew-Base wird jetzt als Pin auf der Dashboard-Karte gerendert.
export default function CrewBasePage() {
  redirect("/dashboard");
}

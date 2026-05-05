import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Crew-Base wird jetzt als Pin auf der Karte gerendert.
export default function CrewBasePage() {
  redirect("/karte");
}

import { PageTitle, Card } from "../_components/ui";
import { ExperimentsClient } from "./experiments-client";

export const dynamic = "force-dynamic";

export default function ExperimentsPage() {
  return (
    <>
      <PageTitle title="🧪 A/B-Experimente" subtitle="Varianten erstellen, zuweisen, auswerten" />
      <Card><ExperimentsClient /></Card>
    </>
  );
}

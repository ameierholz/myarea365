import { PageTitle, Card } from "../_components/ui";
import { ErasClient } from "./eras-client";

export const dynamic = "force-dynamic";

export default function ErasAdminPage() {
  return (
    <>
      <PageTitle
        title="🏙️ Stadt-Ären"
        subtitle="Heimat-Server-Lifecycle pro Stadt. Manuelles Beenden einer Ära schließt sie ab, snapshotted die Hall-of-Fame und startet Ära N+1."
      />
      <Card>
        <ErasClient />
      </Card>
    </>
  );
}

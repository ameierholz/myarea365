import { PageTitle, Card } from "../_components/ui";
import { SeasonsClient } from "./seasons-client";
import { SeasonStats } from "./season-stats";

export const dynamic = "force-dynamic";

export default function SeasonsAdminPage() {
  return (
    <>
      <PageTitle title="🗓️ Arena-Saisons" subtitle="Saisons starten, beenden, Rollover — inkl. Prestige-Vergabe" />

      <Card className="mb-6">
        <SeasonStats />
      </Card>

      <Card>
        <SeasonsClient />
      </Card>
    </>
  );
}

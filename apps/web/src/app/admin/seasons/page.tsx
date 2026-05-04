import { PageTitle, Card } from "../_components/ui";
import { SeasonsClient } from "./seasons-client";
import { SeasonStats } from "./season-stats";
import { SeasonsManagementClient } from "./seasons-management-client";

export const dynamic = "force-dynamic";

export default function SeasonsAdminPage() {
  return (
    <>
      <PageTitle
        title="🗓️ Saison-Verwaltung"
        subtitle="Shop-Liga · Arena · Turf-Krieg — Aktive Saisons, manuelle Eingriffe, Reward-Tiers"
      />

      <Card className="mb-6">
        <SeasonsManagementClient />
      </Card>

      <PageTitle
        title="⚔️ Arena-Saison-Lifecycle (Legacy)"
        subtitle="Direkter Zugriff auf arena_season_start / _end / _rollover"
      />
      <Card className="mb-6">
        <SeasonStats />
      </Card>
      <Card>
        <SeasonsClient />
      </Card>
    </>
  );
}

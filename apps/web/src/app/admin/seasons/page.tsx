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

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">🏙️ Metropol-Saga (KvK)</div>
            <div className="text-text-muted text-sm">
              Crew-vs-Crew Bracket-Saison auf realer Stadt-Map. Round-Lifecycle, Matchmaking, Map-Generation.
            </div>
          </div>
          <a href="/admin/saga" className="px-4 py-2 rounded-lg bg-primary text-bg-deep font-bold text-sm">
            Zur Saga-Verwaltung →
          </a>
        </div>
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

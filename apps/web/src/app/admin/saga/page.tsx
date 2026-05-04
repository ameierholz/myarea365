import { requireStaff } from "@/lib/admin";
import { SagaAdminClient } from "./saga-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminSagaPage() {
  await requireStaff();
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-black text-white mb-4">🏙️ Metropol-Saga — Verwaltung</h1>
        <p className="text-text-muted text-sm mb-6">
          Round-Lifecycle, Bracket-Matchmaking, Map-Generation und Force-Aktionen.
        </p>
        <SagaAdminClient />
      </div>
    </main>
  );
}

import { requireStaff } from "@/lib/admin";
import { BracketMapPreview } from "./bracket-map-preview";

export const dynamic = "force-dynamic";

export default async function BracketPreviewPage({ params }: { params: Promise<{ bracket_id: string }> }) {
  await requireStaff();
  const { bracket_id } = await params;
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-3">
          <a href="/admin/saga" className="text-xs text-text-muted hover:text-white">← Zurück zur Saga-Verwaltung</a>
        </div>
        <h1 className="text-2xl font-black text-white mb-4">🏙️ Bracket-Preview</h1>
        <BracketMapPreview bracketId={bracket_id} />
      </div>
    </main>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Stat } from "../../_components/ui";
import { ShopActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ShopDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();

  const { data: shop } = await sb.from("local_businesses").select("*").eq("id", id).maybeSingle();
  if (!shop) return <div className="text-red-400">Shop nicht gefunden.</div>;

  const { data: sub } = await sb.from("shop_subscriptions").select("*").eq("shop_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <>
      <div className="mb-4"><Link href="/admin/shops" className="text-sm text-[#22D1C3]">← Zur Übersicht</Link></div>
      <PageTitle title={shop.name} subtitle={`${shop.city ?? ""} · ${shop.category ?? ""}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Plan" value={shop.plan ?? "free"} color="#FFD700" />
        <Stat label="Check-ins" value={shop.checkin_count ?? 0} color="#22D1C3" />
        <Stat label="Deal-Redemptions" value={shop.redemption_count ?? 0} color="#4ade80" />
        <Stat label="Rating" value={shop.rating ? `★ ${shop.rating}` : "—"} color="#FF6B4A" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold mb-3">Stammdaten</h2>
          <dl className="text-sm space-y-2">
            <Row label="ID"><code className="text-[11px] text-[#8b8fa3]">{shop.id}</code></Row>
            <Row label="Adresse">{shop.address ?? "—"}</Row>
            <Row label="PLZ / Stadt">{shop.zip ?? "—"} {shop.city ?? ""}</Row>
            <Row label="Kontakt">{shop.contact_email ?? "—"}</Row>
            <Row label="Telefon">{shop.contact_phone ?? "—"}</Row>
            <Row label="Verifiziert">{shop.verified ? <Badge tone="success">✓</Badge> : <Badge tone="danger">nein</Badge>}</Row>
            <Row label="Erstellt">{new Date(shop.created_at).toLocaleString("de-DE")}</Row>
            {shop.spotlight_until && (
              <Row label="Spotlight bis">{new Date(shop.spotlight_until).toLocaleString("de-DE")}</Row>
            )}
          </dl>
        </Card>

        <Card>
          <h2 className="font-bold mb-3">Aktionen</h2>
          <ShopActions
            shopId={shop.id}
            verified={!!shop.verified}
            plan={shop.plan ?? "free"}
            spotlightActive={!!shop.spotlight_until && new Date(shop.spotlight_until) > new Date()}
          />
        </Card>

        <Card className="md:col-span-2">
          <h2 className="font-bold mb-3">Abo</h2>
          {sub ? (
            <dl className="text-sm space-y-2">
              <Row label="Plan"><Badge tone="info">{sub.plan}</Badge></Row>
              <Row label="Status"><Badge tone={sub.status === "active" ? "success" : "danger"}>{sub.status}</Badge></Row>
              <Row label="Monatspreis">€ {sub.monthly_price_eur ?? "—"}</Row>
              <Row label="Periode">{sub.current_period_start && sub.current_period_end ? `${new Date(sub.current_period_start).toLocaleDateString("de-DE")} — ${new Date(sub.current_period_end).toLocaleDateString("de-DE")}` : "—"}</Row>
            </dl>
          ) : <p className="text-sm text-[#8b8fa3]">Kein aktives Abo.</p>}
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#8b8fa3]">{label}</dt><dd className="text-white text-right">{children}</dd></div>;
}

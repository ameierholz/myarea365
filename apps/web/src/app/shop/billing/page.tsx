"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShopBillingModal } from "@/components/shop-billing-modal";

/**
 * Deep-Link-Ziel für /shop/billing — öffnet den Billing-Modal und leitet
 * nach Schließen zurück zum Dashboard. Der Primär-Einstieg ist der
 * "💳 Abrechnung & Paket"-Button in der Shop-Dashboard-Top-Nav.
 */
export default function ShopBillingRoutePage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) router.push("/shop-dashboard");
  }, [open, router]);

  return (
    <main style={{ minHeight: "100vh", background: "#0F1115" }}>
      {open && <ShopBillingModal onClose={() => setOpen(false)} />}
    </main>
  );
}

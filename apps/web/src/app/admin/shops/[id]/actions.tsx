"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Select } from "../../_components/ui";

export function ShopActions({ shopId, verified, plan, spotlightActive }: {
  shopId: string; verified: boolean; plan: string; spotlightActive: boolean;
}) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [newPlan, setNewPlan] = useState(plan);

  async function apply(updates: Record<string, unknown>, action: string) {
    start(async () => {
      await sb.from("local_businesses").update(updates).eq("id", shopId);
      await sb.from("admin_audit_log").insert({ action, target_type: "shop", target_id: shopId, details: updates });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Button
        variant={verified ? "secondary" : "primary"}
        onClick={() => apply({ verified: !verified }, verified ? "shop.unverify" : "shop.verify")}
        disabled={pending}
      >
        {verified ? "✗ Verifizierung entziehen" : "✓ Verifizieren"}
      </Button>

      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Plan</label>
        <div className="flex gap-2">
          <Select value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="spotlight">Spotlight</option>
          </Select>
          <Button variant="primary" size="sm" onClick={() => apply({ plan: newPlan }, "shop.plan_change")} disabled={pending || plan === newPlan}>
            Speichern
          </Button>
        </div>
      </div>

      {spotlightActive ? (
        <Button variant="secondary" onClick={() => apply({ spotlight_until: null }, "shop.spotlight_off")} disabled={pending}>
          ⭐ Spotlight beenden
        </Button>
      ) : (
        <Button variant="primary" onClick={() => {
          const days = parseInt(prompt("Spotlight für wie viele Tage?", "3") ?? "0");
          if (!days) return;
          apply({ spotlight_until: new Date(Date.now() + days * 86400000).toISOString() }, "shop.spotlight_on");
        }} disabled={pending}>
          ⭐ Spotlight aktivieren
        </Button>
      )}
    </div>
  );
}

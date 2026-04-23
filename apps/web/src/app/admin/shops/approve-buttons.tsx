"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveButtons({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    const res = await fetch("/api/admin/shop/approve", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function reject() {
    const reason = window.prompt("Ablehnungsgrund (wird dem Shop-Owner per Mail geschickt):");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    const res = await fetch("/api/admin/shop/reject", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, reason: reason.trim() }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button onClick={approve} disabled={busy}
        className="text-xs bg-[#4ade80]/20 border border-[#4ade80] text-[#4ade80] font-bold px-3 py-1 rounded hover:bg-[#4ade80]/30 disabled:opacity-50">
        ✓ Freigeben
      </button>
      <button onClick={reject} disabled={busy}
        className="text-xs bg-[#FF2D78]/15 border border-[#FF2D78] text-[#FF2D78] font-bold px-3 py-1 rounded hover:bg-[#FF2D78]/25 disabled:opacity-50">
        ✗ Ablehnen
      </button>
    </div>
  );
}

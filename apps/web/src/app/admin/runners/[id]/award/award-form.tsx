"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea } from "../../../_components/ui";

export function AwardForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [xp, setXp] = useState("");
  const [crowns, setCrowns] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("compensation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const xpNum = parseInt(xp || "0", 10);
    const crownNum = parseInt(crowns || "0", 10);
    if (!reason.trim()) { setError("Begründung ist Pflicht (für Audit-Log)"); return; }
    if (xpNum === 0 && crownNum === 0) { setError("Mindestens XP oder Crowns angeben"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/xp-awards", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, xp_delta: xpNum, crown_delta: crownNum, reason: reason.trim(), category }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setError(j.error || "Unbekannter Fehler"); return; }
      setXp(""); setCrowns(""); setReason("");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b8fa3]">XP-Delta</label>
          <Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} placeholder="z.B. 500 oder -100" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b8fa3]">Crowns-Delta 👑</label>
          <Input type="number" value={crowns} onChange={(e) => setCrowns(e.target.value)} placeholder="z.B. 5 oder -1" />
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b8fa3]">Kategorie</label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">
          <option value="compensation">Entschädigung (Bug/Downtime)</option>
          <option value="contest_prize">Wettbewerbs-Preis</option>
          <option value="bug_makeup">Bug-Wiedergutmachung</option>
          <option value="manual_grant">Manuelle Vergabe</option>
          <option value="other">Sonstiges</option>
        </Select>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b8fa3]">Begründung (Pflicht, für Audit)</label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z.B. Entschädigung für Server-Ausfall am 01.05." rows={3} />
      </div>
      {error && <div className="text-xs text-[#FF2D78] bg-[#FF2D78]/10 border border-[#FF2D78]/30 rounded-lg p-2">{error}</div>}
      <Button onClick={submit} disabled={busy}>{busy ? "Vergebe…" : "Vergabe ausführen"}</Button>
    </div>
  );
}

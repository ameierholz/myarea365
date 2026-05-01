"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Badge, Card, Table, Tr, Td, Input, Textarea } from "../_components/ui";
import type { RefundRow } from "./page";

export function RefundsClient({ initial }: { initial: RefundRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "processed">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => filter === "all" ? initial : initial.filter((r) => r.status === filter), [initial, filter]);

  async function decide(id: string, action: "approve" | "reject" | "mark_processed") {
    const note = action !== "mark_processed" ? prompt("Notiz zur Entscheidung (optional)") : null;
    setBusyId(id);
    try {
      const r = await fetch("/api/admin/refunds", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, decision_note: note ?? undefined }),
      });
      if (r.ok) router.refresh();
    } finally { setBusyId(null); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "processed", "all"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === s ? "bg-[#22D1C3] text-black" : "bg-white/5 text-[#dde3f5] hover:bg-white/10"}`}>
              {s} ({initial.filter((r) => s === "all" ? true : r.status === s).length})
            </button>
          ))}
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? "× Schließen" : "+ Neuer Refund"}</Button>
      </div>

      {showCreate && <CreateForm onCreated={() => { setShowCreate(false); router.refresh(); }} />}

      <Table headers={["User", "Betrag", "Grund", "Status", "Erstellt", "Aktionen"]}>
        {filtered.map((r) => {
          const u = r.user;
          return (
            <Tr key={r.id}>
              <Td>
                <Link href={`/admin/runners/${r.user_id}`} className="text-[#22D1C3] hover:underline">
                  {u?.display_name ?? u?.username ?? r.user_id.slice(0, 8)}
                </Link>
                <div className="text-[10px] text-[#8b8fa3]">{u?.email}</div>
              </Td>
              <Td><span className="font-bold">{(r.amount_cents / 100).toFixed(2)} {r.currency}</span></Td>
              <Td className="text-xs">{r.reason}{r.external_ref && <div className="text-[10px] text-[#8b8fa3]">Ref: {r.external_ref}</div>}</Td>
              <Td>
                <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : r.status === "processed" ? "info" : "warning"}>{r.status}</Badge>
                {r.decision_note && <div className="text-[10px] text-[#8b8fa3] mt-1 italic">"{r.decision_note}"</div>}
              </Td>
              <Td className="text-xs text-[#8b8fa3]">{new Date(r.created_at).toLocaleString("de-DE")}</Td>
              <Td>
                {r.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => decide(r.id, "approve")} disabled={busyId === r.id}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(r.id, "reject")} disabled={busyId === r.id}>Reject</Button>
                  </div>
                )}
                {r.status === "approved" && (
                  <Button size="sm" variant="secondary" onClick={() => decide(r.id, "mark_processed")} disabled={busyId === r.id}>Als ausgezahlt markieren</Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
    </>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [reason, setReason] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!userId || isNaN(cents) || cents <= 0 || !reason.trim()) {
      setError("user_id, gültiger Betrag und Grund nötig");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/refunds", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", user_id: userId, amount_cents: cents, currency, reason, external_ref: externalRef || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setError(j.error || "Fehler"); return; }
      onCreated();
    } finally { setBusy(false); }
  }

  return (
    <Card className="mb-4">
      <h2 className="font-bold mb-3">Neuer Refund-Antrag</h2>
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <div><label className="text-[11px] uppercase text-[#8b8fa3]">User-ID</label><Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid" /></div>
        <div><label className="text-[11px] uppercase text-[#8b8fa3]">Betrag</label><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="9.99" /></div>
        <div><label className="text-[11px] uppercase text-[#8b8fa3]">Währung</label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" /></div>
        <div><label className="text-[11px] uppercase text-[#8b8fa3]">Stripe/PayPal-Ref (optional)</label><Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="ch_xxx oder PAY-XX" /></div>
      </div>
      <label className="text-[11px] uppercase text-[#8b8fa3]">Grund</label>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z.B. Doppelt belastet wegen Gateway-Fehler" rows={2} />
      {error && <div className="text-xs text-[#FF2D78] mt-2">{error}</div>}
      <div className="mt-3"><Button onClick={submit} disabled={busy}>{busy ? "Erstelle…" : "Antrag erstellen"}</Button></div>
    </Card>
  );
}

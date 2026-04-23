"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DangerZone({ deletionPending }: { deletionPending: boolean }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      setError('Bitte „DELETE" exakt eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Fehler beim Löschen");
        setBusy(false);
        return;
      }
      alert("Konto wurde zur Löschung markiert. Du wirst ausgeloggt.");
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setBusy(false);
    }
  }

  if (deletionPending) {
    return (
      <section className="p-5 rounded-2xl border border-[#FF2D78]/40 bg-[#FF2D78]/10">
        <h2 className="text-lg font-bold text-[#FF2D78] mb-2">⚠ Konto-Löschung läuft</h2>
        <p className="text-sm text-text-muted">
          Dein Konto wurde zur Löschung markiert und wird innerhalb von 14 Tagen endgültig entfernt.
          Wenn du das rückgängig machen möchtest, kontaktiere uns über den Support.
        </p>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-2xl border border-[#FF2D78]/30 bg-[#FF2D78]/5">
      <h2 className="text-lg font-bold text-[#FF2D78] mb-2">🗑 Konto löschen</h2>
      <p className="text-sm text-text-muted mb-3">
        DSGVO Art. 17 — Recht auf Löschung. Nach Bestätigung wird dein öffentliches Profil
        sofort anonymisiert und deine Rohdaten innerhalb von <b>14 Tagen</b> endgültig entfernt.
        Diese Aktion kann nicht rückgängig gemacht werden.
      </p>
      <label className="block text-xs text-text-muted mb-1.5">
        Tippe „DELETE" (Großbuchstaben) zur Bestätigung:
      </label>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border text-white text-sm mb-3"
        disabled={busy}
      />
      {error && <div className="text-xs text-[#FF2D78] mb-2">{error}</div>}
      <button
        onClick={deleteAccount}
        disabled={busy || confirmText !== "DELETE"}
        className="px-5 py-2.5 rounded-lg bg-[#FF2D78] text-white font-bold text-sm disabled:opacity-50"
      >
        {busy ? "Löschung wird ausgeführt…" : "Konto jetzt löschen"}
      </button>
    </section>
  );
}

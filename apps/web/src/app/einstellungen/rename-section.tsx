"use client";

import { useState } from "react";

export function RenameSection({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/account/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; message?: string };
      if (!j.ok) {
        setMsg({ type: "err", text: j.message ?? j.error ?? "Fehler" });
        return;
      }
      setMsg({ type: "ok", text: "Name geändert" });
    } catch {
      setMsg({ type: "err", text: "Netzwerkfehler" });
    } finally {
      setBusy(false);
    }
  }

  const dirty = name.trim() !== initial.trim();

  return (
    <section className="p-5 rounded-2xl bg-bg-card border border-border">
      <h2 className="text-lg font-bold text-white mb-2">Anzeigename</h2>
      <p className="text-sm text-text-muted mb-4">
        So tauchst du auf der Karte und bei deiner Crew auf. 2–15 Zeichen.
      </p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={15}
          className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-white border border-white/10 focus:border-primary outline-none text-sm"
          placeholder="Dein Name"
        />
        <button
          onClick={() => void save()}
          disabled={busy || !dirty || name.trim().length < 2}
          className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/40 font-bold text-sm hover:bg-primary/30 disabled:opacity-50"
        >
          {busy ? "…" : "Speichern"}
        </button>
      </div>
      {msg && (
        <div className={`mt-2 text-xs ${msg.type === "ok" ? "text-primary" : "text-accent"}`}>
          {msg.text}
        </div>
      )}
    </section>
  );
}

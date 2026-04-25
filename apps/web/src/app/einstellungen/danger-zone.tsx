"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function DangerZone({ deletionPending }: { deletionPending: boolean }) {
  const t = useTranslations("DangerZone");
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      setError(t("confirmInputErr"));
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
        setError(json.error ?? t("errorPrefix"));
        setBusy(false);
        return;
      }
      alert(t("alertMarked"));
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("networkErr"));
      setBusy(false);
    }
  }

  if (deletionPending) {
    return (
      <section className="p-5 rounded-2xl border border-[#FF2D78]/40 bg-[#FF2D78]/10">
        <h2 className="text-lg font-bold text-[#FF2D78] mb-2">{t("pendingTitle")}</h2>
        <p className="text-sm text-text-muted">
          {t("pendingBody")}
        </p>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-2xl border border-[#FF2D78]/30 bg-[#FF2D78]/5">
      <h2 className="text-lg font-bold text-[#FF2D78] mb-2">{t("title")}</h2>
      <p className="text-sm text-text-muted mb-3">
        {t.rich("body", { b: (chunks) => <b>{chunks}</b> })}
      </p>
      <label className="block text-xs text-text-muted mb-1.5">
        {t("confirmHint")}
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
        {busy ? t("btnBusy") : t("btn")}
      </button>
    </section>
  );
}

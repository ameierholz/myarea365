"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Category = "general" | "bug" | "billing" | "partner" | "abuse" | "other";

const CAT_DEFS: { key: Category; emoji: string; supportKey: "catGeneral" | "catBug" | "catPartner" | "catAbuse"; pageKey?: "catBillingLong" | "catOtherLong" }[] = [
  { key: "general", emoji: "💬", supportKey: "catGeneral" },
  { key: "bug",     emoji: "🐛", supportKey: "catBug" },
  { key: "billing", emoji: "💳", supportKey: "catGeneral", pageKey: "catBillingLong" },
  { key: "partner", emoji: "🤝", supportKey: "catPartner" },
  { key: "abuse",   emoji: "⚠️", supportKey: "catAbuse" },
  { key: "other",   emoji: "📎", supportKey: "catGeneral", pageKey: "catOtherLong" },
];

export function SupportForm({
  prefillEmail,
  prefillName,
}: {
  prefillEmail: string;
  prefillName: string;
}) {
  const tS = useTranslations("Support");
  const tP = useTranslations("SupportPage");
  const [email, setEmail] = useState(prefillEmail);
  const [name, setName] = useState(prefillName);
  const [category, setCategory] = useState<Category>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !subject || !body) {
      setError(tS("errMissing"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, category, subject, body }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? tS("errSend"));
        return;
      }
      setDone({ id: j.ticket_id });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="p-6 rounded-xl bg-[#22D1C3]/10 border border-[#22D1C3]/40">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-lg font-black text-white mb-1">
          {tP("doneLong")}
        </div>
        <div className="text-sm text-[#a8b4cf] mb-3">
          {tP.rich("doneTicketLine", { email, b: (chunks) => <b>{chunks}</b> })}
        </div>
        <code className="block p-2 rounded bg-black/30 text-xs font-mono text-[#22D1C3]">
          {done.id}
        </code>
        <button
          onClick={() => {
            setDone(null);
            setSubject("");
            setBody("");
          }}
          className="mt-4 text-xs text-[#22D1C3] hover:underline"
        >
          {tP("doneNewLong")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={tP("labelNameLong")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tP("phNameLong")}
            className="w-full bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field label={tS("labelEmail")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={tS("phEmail")}
            className="w-full bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label={tS("labelTopic")}>
        <div className="grid grid-cols-3 gap-2">
          {CAT_DEFS.map((c) => {
            const label = c.pageKey ? tP(c.pageKey) : tS(c.supportKey);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                  category === c.key
                    ? "bg-[#22D1C3]/15 border-[#22D1C3]/60 text-[#22D1C3]"
                    : "bg-[#1A1D23] border-white/10 text-[#a8b4cf] hover:border-white/20"
                }`}
              >
                <span className="block text-base mb-0.5">{c.emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={tS("labelSubject")}>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={120}
          placeholder={tP("phSubjectLong")}
          className="w-full bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <Field label={tS("labelMessage")}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          maxLength={4000}
          placeholder={tP("phMessageLong")}
          className="w-full bg-[#1A1D23] border border-white/10 rounded-lg px-3 py-2 text-sm resize-y"
        />
        <div className="text-[10px] text-[#6c7590] mt-1 text-right">
          {body.length}/4000
        </div>
      </Field>

      {error && (
        <div className="p-3 rounded-lg bg-[#FF2D78]/10 border border-[#FF2D78]/40 text-xs text-[#FF2D78]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full px-4 py-3 rounded-xl text-sm font-black text-[#0F1115] disabled:opacity-40"
        style={{
          background: "linear-gradient(135deg, #22D1C3 0%, #FFD700 100%)",
        }}
      >
        {busy ? tP("submitBusy") : tS("submit")}
      </button>

      <p className="text-[10px] text-[#6c7590] leading-relaxed">
        {tP("footnoteLong")}
      </p>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-black tracking-widest text-[#8B8FA3] mb-1.5">
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {LOCALES.map((loc) => {
        const active = loc === current;
        const meta = LOCALE_LABELS[loc];
        return (
          <button
            key={loc}
            disabled={pending || active}
            onClick={() => startTransition(() => { void setLocale(loc); })}
            style={{
              padding: "6px 12px", borderRadius: 10,
              background: active ? "#22D1C3" : "rgba(30, 38, 60, 0.55)",
              color: active ? "#0F1115" : "#FFF",
              border: active ? "none" : "1px solid rgba(255,255,255,0.14)",
              cursor: active ? "default" : "pointer",
              fontSize: 13, fontWeight: 800,
              opacity: pending ? 0.6 : 1,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <img
              src={`https://flagcdn.com/w80/${meta.iso}.png`}
              srcSet={`https://flagcdn.com/w160/${meta.iso}.png 2x`}
              width={18} height={14}
              alt={meta.native}
              style={{ borderRadius: 2, objectFit: "cover", display: "inline-block", verticalAlign: "middle" }}
            />
            <span>{meta.native}</span>
          </button>
        );
      })}
    </div>
  );
}

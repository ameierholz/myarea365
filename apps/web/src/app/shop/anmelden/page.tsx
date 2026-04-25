"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { SHOP_CATEGORY_GROUPS } from "@/lib/shop-categories";

type RegT = ReturnType<typeof useTranslations<"ShopRegister">>;

const ERR_KEYS: Record<string, "errMissingName" | "errMissingCategory" | "errMissingStreet" | "errMissingZip" | "errMissingCity" | "errMissingEmail" | "errInvalidEmail" | "errInvalidZip"> = {
  missing_name: "errMissingName",
  missing_category: "errMissingCategory",
  missing_street: "errMissingStreet",
  missing_zip: "errMissingZip",
  missing_city: "errMissingCity",
  missing_contact_email: "errMissingEmail",
  invalid_email: "errInvalidEmail",
  invalid_zip: "errInvalidZip",
};

export default function ShopRegisterPage() {
  const t = useTranslations("ShopRegister");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      name:          String(fd.get("name") ?? "").trim(),
      category:      String(fd.get("category") ?? "").trim(),
      street:        String(fd.get("street") ?? "").trim(),
      zip:           String(fd.get("zip") ?? "").trim(),
      city:          String(fd.get("city") ?? "").trim(),
      state:         String(fd.get("state") ?? "").trim(),
      country:       String(fd.get("country") ?? "DE").trim(),
      contact_email: String(fd.get("contact_email") ?? "").trim(),
      contact_phone: String(fd.get("contact_phone") ?? "").trim(),
      description:   String(fd.get("description") ?? "").trim(),
      website:       String(fd.get("website") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/shop/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) {
        if (j.error === "auth_required") {
          setError(t("errAuth"));
          setTimeout(() => router.push("/login?next=/shop/anmelden"), 2000);
          return;
        }
        const errKey = ERR_KEYS[j.error as string];
        setError(errKey ? t(errKey) : (j.error ?? t("errUnknown")));
        return;
      }
      setDone(j.shop_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", padding: 40 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>{t("doneTitle")}</h1>
          <p style={{ color: "#a8b4cf", lineHeight: 1.6, marginBottom: 24 }}>
            {t("doneBody")}
          </p>
          <button
            onClick={() => router.push("/shop-dashboard")}
            style={BTN_PRIMARY}
          >{t("doneCta")}</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", padding: "40px 20px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          style={BTN_BACK}
        >{t("back")}</button>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#22D1C3", fontWeight: 900, marginBottom: 8 }}>
          {t("kicker")}
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>
          {t("heroTitle")}
        </h1>
        <p style={{ color: "#a8b4cf", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
          {t("heroBody")}
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10, marginBottom: 32,
        }}>
          <BenefitCard icon="📍" text={t("benefit1")} />
          <BenefitCard icon="🪙" text={t("benefit2")} />
          <BenefitCard icon="📊" text={t("benefit3")} />
          <BenefitCard icon="⚡" text={t("benefit4")} />
        </div>

        <form onSubmit={handleSubmit} style={{
          background: "#1A1D23", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)", padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16 }}>{t("sectionShopData")}</h2>

          <Field name="name" label={t("fName")} placeholder={t("fNamePh")} required tt={t} />
          <Field name="category" label={t("fCategory")} asCategorySelect required tt={t} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <Field name="street" label={t("fStreet")} placeholder={t("fStreetPh")} required tt={t} />
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
              <Field name="zip" label={t("fZip")} placeholder={t("fZipPh")} required maxLength={5} tt={t} />
              <Field name="city" label={t("fCity")} placeholder={t("fCityPh")} required tt={t} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <Field name="state" label={t("fState")} placeholder={t("fStatePh")} tt={t} />
              <Field name="country" label={t("fCountry")} asSelect required options={["DE","AT","CH"]} tt={t} />
            </div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "20px 0 12px" }}>{t("sectionContact")}</h2>
          <Field name="contact_email" label={t("fEmail")} placeholder={t("fEmailPh")} required type="email" tt={t} />
          <Field name="contact_phone" label={t("fPhone")} placeholder={t("fPhonePh")} type="tel" tt={t} />
          <Field name="website" label={t("fWebsite")} placeholder={t("fWebsitePh")} type="url" tt={t} />

          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "20px 0 12px" }}>{t("sectionDescription")}</h2>
          <Field name="description" label={t("fDesc")} asTextarea
            placeholder={t("fDescPh")} tt={t} />

          {error && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 10,
              background: "rgba(255,45,120,0.12)", border: "1px solid #FF2D78",
              color: "#FF2D78", fontSize: 13, fontWeight: 700,
            }}>⚠️ {error}</div>
          )}

          <button type="submit" disabled={busy} style={{ ...BTN_PRIMARY, marginTop: 20, width: "100%", opacity: busy ? 0.6 : 1 }}>
            {busy ? t("submitBusy") : t("submit")}
          </button>

          <p style={{ fontSize: 11, color: "#8B8FA3", marginTop: 14, lineHeight: 1.5 }}>
            {t("submitFootnote")}
          </p>
        </form>
      </div>
    </main>
  );
}

const BTN_PRIMARY: React.CSSProperties = {
  padding: "12px 20px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
  color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 0.5,
  cursor: "pointer",
};

const BTN_BACK: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 999, marginBottom: 16,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#a8b4cf", fontSize: 13, fontWeight: 700,
  cursor: "pointer",
};

function BenefitCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: "rgba(34,209,195,0.08)",
      border: "1px solid rgba(34,209,195,0.25)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#D0D0D5", fontWeight: 700, lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}

function Field({ name, label, placeholder, required, type = "text", maxLength, asTextarea, asSelect, asCategorySelect, options, tt }: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  asTextarea?: boolean;
  asSelect?: boolean;
  asCategorySelect?: boolean;
  options?: string[];
  tt: RegT;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
    color: "#F0F0F0", fontSize: 14, fontFamily: "inherit",
  };
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "#a8b4cf", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {asTextarea ? (
        <textarea name={name} placeholder={placeholder} rows={3} style={inputStyle} maxLength={500} />
      ) : asCategorySelect ? (
        <select name={name} required={required} defaultValue="" style={inputStyle}>
          <option value="" disabled>{tt("selectPlaceholder")}</option>
          {SHOP_CATEGORY_GROUPS.map((grp) => (
            <optgroup key={grp.label} label={grp.label}>
              {grp.items.map((it) => <option key={it} value={it}>{it}</option>)}
            </optgroup>
          ))}
        </select>
      ) : asSelect ? (
        <select name={name} required={required} defaultValue="" style={inputStyle}>
          <option value="" disabled>{tt("selectPlaceholder")}</option>
          {(options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input name={name} type={type} placeholder={placeholder} required={required} maxLength={maxLength} style={inputStyle} />
      )}
    </label>
  );
}

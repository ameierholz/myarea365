"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Shop = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  state: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  opening_hours: DayHours[] | null;
  paused_at: string | null;
  active: boolean;
};

type DayHours = { day: string; open: string; close: string; closed: boolean };

type SettT = ReturnType<typeof useTranslations<"ShopSettings">>;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABEL_KEYS: Record<DayKey, "dayMon" | "dayTue" | "dayWed" | "dayThu" | "dayFri" | "daySat" | "daySun"> = {
  mon: "dayMon", tue: "dayTue", wed: "dayWed", thu: "dayThu", fri: "dayFri", sat: "daySat", sun: "daySun",
};

import { SHOP_CATEGORY_GROUPS } from "@/lib/shop-categories";

const defaultHours: DayHours[] = DAY_KEYS.map((k) => ({
  day: k, open: "09:00", close: "18:00", closed: k === "sun",
}));

export function ShopSettingsPanel({ shopId, onBillingClick }: { shopId: string; onBillingClick: () => void }) {
  const t = useTranslations("ShopSettings");
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [hintIsError, setHintIsError] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/shop/my`, { cache: "no-store" });
      const j = await res.json() as { shops: Shop[] };
      const match = j.shops?.find((x) => x.id === shopId);
      setShop(match ?? j.shops?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(body: Record<string, unknown>, hint?: string) {
    setSaving(true);
    const res = await fetch("/api/shop/profile", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, ...body }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.ok) {
      setHintIsError(false);
      setSavedHint(hint ?? t("savedDefault"));
      setTimeout(() => setSavedHint(null), 2000);
      void load();
    } else {
      setHintIsError(true);
      setSavedHint(t("errorPrefix") + (j.error ?? t("errorUnknown")));
    }
  }

  if (loading) {
    return <div style={{ padding: 20, color: "#a8b4cf" }}>{t("loading")}</div>;
  }
  if (!shop) {
    return (
      <div style={{
        padding: 30, textAlign: "center",
        background: "rgba(41, 51, 73, 0.35)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", marginBottom: 6 }}>
          {t("noShopTitle")}
        </div>
        <div style={{ fontSize: 13, color: "#a8b4cf", marginBottom: 16, lineHeight: 1.5 }}>
          {t("noShopBody")}
        </div>
        <Link href="/shop/anmelden" style={{
          display: "inline-block",
          padding: "10px 18px", borderRadius: 10,
          background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
          color: "#0F1115", fontSize: 13, fontWeight: 900, textDecoration: "none",
        }}>{t("noShopCta")}</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {savedHint && (
        <div style={{
          position: "sticky", top: 10, zIndex: 10,
          alignSelf: "flex-end",
          padding: "6px 12px", borderRadius: 8,
          background: hintIsError ? "rgba(255,45,120,0.2)" : "rgba(74,222,128,0.2)",
          color: hintIsError ? "#FF2D78" : "#4ade80",
          fontSize: 12, fontWeight: 800,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>{hintIsError ? "⚠️" : "✓"} {savedHint}</div>
      )}

      <ProfileBlock shop={shop} onSave={patch} saving={saving} t={t} />
      <HoursBlock shop={shop} onSave={patch} t={t} />
      <GpsBlock shop={shop} onSave={patch} t={t} />
      <NotificationsBlock shopId={shopId} t={t} />
      <TeamBlock shopId={shopId} t={t} />
      <BillingShortcut onClick={onBillingClick} t={t} />
      <DangerZone shop={shop} onReload={load} onSave={patch} t={t} />
    </div>
  );
}

function ProfileBlock({ shop, onSave, saving, t }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
  saving: boolean;
  t: SettT;
}) {
  const [form, setForm] = useState({
    name: shop.name ?? "",
    category: shop.category ?? "",
    description: shop.description ?? "",
    city: shop.city ?? "",
    zip: shop.zip ?? "",
    state: shop.state ?? "",
    country: shop.country ?? "DE",
    contact_email: shop.contact_email ?? "",
    contact_phone: shop.contact_phone ?? "",
    website: shop.website ?? "",
    logo_url: shop.logo_url ?? "",
    cover_url: shop.cover_url ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onSave(form, t("savedProfile"));
  }

  return (
    <Block title={t("blockProfile")}>
      <form onSubmit={handleSubmit} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={t("fName")}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={INP} required />
        </Field>
        <Field label={t("fCategory")}>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={INP}>
            <option value="">{t("fSelectPh")}</option>
            {SHOP_CATEGORY_GROUPS.map((grp) => (
              <optgroup key={grp.label} label={grp.label}>
                {grp.items.map((it) => <option key={it} value={it}>{it}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label={t("fDesc")}>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} maxLength={500} style={INP} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
          <Field label={t("fZip")}>
            <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} style={INP} maxLength={5} />
          </Field>
          <Field label={t("fCity")}>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={INP} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
          <Field label={t("fState")}>
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={INP} />
          </Field>
          <Field label={t("fCountry")}>
            <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={INP}>
              <option value="DE">DE</option><option value="AT">AT</option><option value="CH">CH</option>
            </select>
          </Field>
        </div>

        <Field label={t("fEmail")}>
          <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} style={INP} />
        </Field>
        <Field label={t("fPhone")}>
          <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} style={INP} />
        </Field>
        <Field label={t("fWebsite")}>
          <input type="url" placeholder="https://…" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={INP} />
        </Field>

        <ImageUpload
          label={t("fLogo")}
          shopId={shop.id}
          kind="logo"
          currentUrl={form.logo_url}
          onUploaded={(url) => setForm({ ...form, logo_url: url })}
          t={t}
        />
        <ImageUpload
          label={t("fCover")}
          shopId={shop.id}
          kind="cover"
          currentUrl={form.cover_url}
          onUploaded={(url) => setForm({ ...form, cover_url: url })}
          t={t}
        />

        <button type="submit" disabled={saving} style={BTN_PRIMARY}>
          {saving ? t("saving") : t("btnSaveProfile")}
        </button>
      </form>
    </Block>
  );
}

function HoursBlock({ shop, onSave, t }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
  t: SettT;
}) {
  const [hours, setHours] = useState<DayHours[]>(
    Array.isArray(shop.opening_hours) && shop.opening_hours.length === 7
      ? shop.opening_hours
      : defaultHours
  );

  function update(idx: number, field: keyof DayHours, value: string | boolean) {
    setHours((h) => h.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  return (
    <Block title={t("blockHours")}>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {DAY_KEYS.map((dk, i) => (
          <div key={dk} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 90px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#FFF", fontWeight: 600 }}>{t(DAY_LABEL_KEYS[dk])}</div>
            <input type="time" value={hours[i].open} disabled={hours[i].closed}
              onChange={(e) => update(i, "open", e.target.value)} style={{ ...INP, padding: "7px 10px" }} />
            <input type="time" value={hours[i].close} disabled={hours[i].closed}
              onChange={(e) => update(i, "close", e.target.value)} style={{ ...INP, padding: "7px 10px" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a8b4cf", cursor: "pointer" }}>
              <input type="checkbox" checked={hours[i].closed}
                onChange={(e) => update(i, "closed", e.target.checked)} />
              {t("closedLabel")}
            </label>
          </div>
        ))}
        <button
          onClick={() => onSave({ opening_hours: hours }, t("savedHours"))}
          style={{ ...BTN_PRIMARY, marginTop: 6 }}
        >{t("btnSaveHours")}</button>
      </div>
    </Block>
  );
}

function GpsBlock({ shop, onSave, t }: {
  shop: Shop;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
  t: SettT;
}) {
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");

  function fromGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
      },
      () => alert(t("alertGpsUnavail")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function save() {
    const la = Number(lat), ln = Number(lng);
    if (!isFinite(la) || !isFinite(ln)) { alert(t("alertCoordsInvalid")); return; }
    if (la < -90 || la > 90 || ln < -180 || ln > 180) { alert(t("alertCoordsRange")); return; }
    void onSave({ lat: la, lng: ln }, t("savedGps"));
  }

  return (
    <Block title={t("blockGps")}>
      <div style={{ padding: 16 }}>
        <p style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
          {t("gpsBody1")} <b style={{ color: "#FFD700" }}>{t("gpsAutoVerify")}</b> {t("gpsBody2")}
          <br />
          <b>{t("gpsTipLead")}</b>{t("gpsTipBody")}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label={t("fLat")}>
            <input type="number" step="any" placeholder="52.4865"
              value={lat} onChange={(e) => setLat(e.target.value)} style={INP} />
          </Field>
          <Field label={t("fLng")}>
            <input type="number" step="any" placeholder="13.4450"
              value={lng} onChange={(e) => setLng(e.target.value)} style={INP} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={fromGeolocation} style={BTN_SECONDARY}>
            {t("btnUseGps")}
          </button>
          <button onClick={save} style={BTN_PRIMARY}>{t("btnSaveGps")}</button>
          <a href={`https://www.google.com/maps?q=${encodeURIComponent(shop.address ?? "")}`}
            target="_blank" rel="noopener noreferrer" style={{ ...BTN_SECONDARY, textDecoration: "none" }}>
            {t("btnGoogleMaps")}
          </a>
        </div>
      </div>
    </Block>
  );
}

type Prefs = {
  email_on_checkin: boolean;
  email_daily_report: boolean;
  email_weekly_summary: boolean;
  kiez_newsletter: boolean;
};
function NotificationsBlock({ shopId, t }: { shopId: string; t: SettT }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/notifications?shop_id=${shopId}`);
    const j = await res.json();
    setPrefs(j.prefs);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(k: keyof Prefs) {
    if (!prefs) return;
    const updated = { ...prefs, [k]: !prefs[k] };
    setPrefs(updated);
    await fetch("/api/shop/notifications", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, [k]: updated[k] }),
    });
  }

  if (!prefs) return <Block title={t("blockNotifications")}><div style={{ padding: 16, color: "#a8b4cf" }}>{t("loadingShort")}</div></Block>;

  return (
    <Block title={t("blockNotifications")}>
      <div style={{ padding: 8 }}>
        <Toggle label={t("notifCheckin")} value={prefs.email_on_checkin} onChange={() => toggle("email_on_checkin")} />
        <Toggle label={t("notifDaily")} value={prefs.email_daily_report} onChange={() => toggle("email_daily_report")} />
        <Toggle label={t("notifWeekly")} value={prefs.email_weekly_summary} onChange={() => toggle("email_weekly_summary")} />
        <Toggle label={t("notifNewsletter")} value={prefs.kiez_newsletter} onChange={() => toggle("kiez_newsletter")} />
      </div>
    </Block>
  );
}

type TeamMember = {
  id: string; email: string; role: string;
  invited_at: string; accepted_at: string | null; user_id: string | null;
};
function TeamBlock({ shopId, t }: { shopId: string; t: SettT }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/team?shop_id=${shopId}`);
    const j = await res.json();
    setMembers(j.members ?? []);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    const res = await fetch("/api/shop/team", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, email, role }),
    });
    setBusy(false);
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? t("errorGeneric")); return; }
    setEmail("");
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm(t("teamConfirmRemove"))) return;
    await fetch(`/api/shop/team?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <Block title={t("blockTeam")}>
      <div style={{ padding: 16 }}>
        <p style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
          {t("teamBody")}
        </p>

        <form onSubmit={invite} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="email" required placeholder={t("teamEmailPh")}
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ ...INP, flex: "1 1 180px" }} />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
            style={{ ...INP, width: 140 }}>
            <option value="manager">{t("teamRoleManager")}</option>
            <option value="staff">{t("teamRoleStaff")}</option>
          </select>
          <button type="submit" disabled={busy} style={BTN_PRIMARY}>
            {busy ? "…" : t("teamInviteBtn")}
          </button>
        </form>

        {error && <div style={{ fontSize: 12, color: "#FF2D78", marginBottom: 10 }}>⚠️ {error}</div>}

        {members.length === 0 ? (
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 8, color: "#8B8FA3", fontSize: 12, textAlign: "center" }}>
            {t("teamEmpty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{m.email}</div>
                  <div style={{ fontSize: 10, color: "#8B8FA3" }}>
                    {m.role.toUpperCase()} ·{" "}
                    {m.accepted_at ? <span style={{ color: "#4ade80" }}>{t("teamStatusActive")}</span> : <span style={{ color: "#FFD700" }}>{t("teamStatusInvited")}</span>}
                  </div>
                </div>
                <button onClick={() => remove(m.id)} style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,45,120,0.4)",
                  background: "transparent", color: "#FF2D78", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>{t("teamRemove")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Block>
  );
}

function BillingShortcut({ onClick, t }: { onClick: () => void; t: SettT }) {
  return (
    <Block title={t("blockBilling")}>
      <button onClick={onClick} style={{
        width: "100%", padding: 16, textAlign: "left", cursor: "pointer",
        background: "transparent", border: "none", color: "#FFF",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t("billingTitle")}</div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 2 }}>
            {t("billingSub")}
          </div>
        </div>
        <span style={{ color: "#22D1C3", fontSize: 18 }}>›</span>
      </button>
    </Block>
  );
}

function DangerZone({ shop, onReload, onSave, t }: {
  shop: Shop;
  onReload: () => Promise<void>;
  onSave: (body: Record<string, unknown>, hint?: string) => Promise<void>;
  t: SettT;
}) {
  const paused = !!shop.paused_at;
  const deleteKeyword = t("deleteKeyword");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function togglePause() {
    await onSave({ paused: !paused }, paused ? t("savedShopActive") : t("savedShopPaused"));
  }

  async function deleteShop() {
    if (confirmText !== deleteKeyword) return;
    setDeleting(true);
    const res = await fetch("/api/shop/delete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shop.id, confirm: "LÖSCHEN" }),
    });
    setDeleting(false);
    const j = await res.json();
    if (j.ok) {
      window.location.href = "/dashboard";
    } else {
      alert(t("alertDeleteError") + (j.error ?? t("errorUnknown")));
    }
    await onReload();
  }

  return (
    <Block title={t("blockAccount")} danger>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Link href="/einstellungen" style={{
          padding: 12, borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#FFF", textDecoration: "none", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{t("accountPasswordLink")}</span>
          <span style={{ color: "#a8b4cf" }}>›</span>
        </Link>

        <div style={{
          padding: 12, borderRadius: 8,
          background: paused ? "rgba(255,215,0,0.08)" : "rgba(74,222,128,0.05)",
          border: `1px solid ${paused ? "#FFD700" : "rgba(74,222,128,0.3)"}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: paused ? "#FFD700" : "#4ade80", marginBottom: 4 }}>
            {paused ? t("shopPausedTitle") : t("shopLiveTitle")}
          </div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 10 }}>
            {t("pauseBody")}
          </div>
          <button onClick={togglePause} style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: paused ? "#4ade80" : "#FFD700", color: "#0F1115",
            fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}>
            {paused ? t("pauseReactivate") : t("pausePause")}
          </button>
        </div>

        <div style={{
          padding: 12, borderRadius: 8,
          background: "rgba(255,45,120,0.08)",
          border: "1px solid rgba(255,45,120,0.35)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF2D78", marginBottom: 4 }}>
            {t("deleteTitle")}
          </div>
          <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 10 }}>
            {t("deleteBody1")} <b style={{ color: "#FF2D78" }}>{deleteKeyword}</b> {t("deleteBody2")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder={deleteKeyword} style={{ ...INP, flex: 1 }} />
            <button onClick={deleteShop} disabled={confirmText !== deleteKeyword || deleting} style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: confirmText === deleteKeyword ? "#FF2D78" : "rgba(255,255,255,0.06)",
              color: confirmText === deleteKeyword ? "#FFF" : "#6c7590",
              fontSize: 12, fontWeight: 900, cursor: confirmText === deleteKeyword ? "pointer" : "not-allowed",
            }}>{deleting ? t("deletingBtn") : t("deleteBtn")}</button>
          </div>
        </div>
      </div>
    </Block>
  );
}

function Block({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        color: danger ? "#FF2D78" : "#a8b4cf",
        fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8,
      }}>{title.toUpperCase()}</div>
      <div style={{
        background: "rgba(41, 51, 73, 0.35)",
        borderRadius: 14, overflow: "hidden",
        border: `1px solid ${danger ? "rgba(255,45,120,0.2)" : "rgba(255,255,255,0.08)"}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

function ImageUpload({ label, shopId, kind, currentUrl, onUploaded, t }: {
  label: string;
  shopId: string;
  kind: "logo" | "cover";
  currentUrl: string;
  onUploaded: (url: string) => void;
  t: SettT;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("shop_id", shopId);
    fd.append("kind", kind);
    try {
      const res = await fetch("/api/shop/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error === "file_too_large" ? t("uploadTooLarge") :
                 j.error === "invalid_mime" ? t("uploadInvalidMime") :
                 j.error ?? t("uploadFailed"));
        return;
      }
      onUploaded(j.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("uploadNetworkErr"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {currentUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentUrl} alt=""
            style={{
              width: kind === "cover" ? 120 : 64,
              height: 64, borderRadius: 10,
              objectFit: "cover",
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }} />
        ) : (
          <div style={{
            width: kind === "cover" ? 120 : 64, height: 64, borderRadius: 10, flexShrink: 0,
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8B8FA3", fontSize: 10,
          }}>{t("noImage")}</div>
        )}
        <div style={{ flex: 1 }}>
          <label style={{ ...BTN_SECONDARY, display: "inline-block", cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? t("imgUploading") : currentUrl ? t("imgReplace") : t("imgUpload")}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              style={{ display: "none" }} />
          </label>
          {currentUrl && (
            <button type="button" onClick={() => onUploaded("")} style={{
              marginLeft: 8, padding: "8px 12px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(255,45,120,0.3)",
              color: "#FF2D78", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>{t("imgRemove")}</button>
          )}
          {error && <div style={{ fontSize: 11, color: "#FF2D78", marginTop: 6 }}>⚠️ {error}</div>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ color: "#FFF", fontSize: 13 }}>{label}</span>
      <button onClick={onChange} style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? "#22D1C3" : "rgba(255,255,255,0.1)",
        border: "none", cursor: "pointer", position: "relative", transition: "all 0.2s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: 10, background: "#FFF",
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

const INP: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
  color: "#F0F0F0", fontSize: 13, fontFamily: "inherit",
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
  color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer",
};
const BTN_SECONDARY: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#F0F0F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/client";

type Msg = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function InboxContent() {
  const t = useTranslations("Inbox");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [open, setOpen] = useState<Msg | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth?.user) { if (alive) setMessages([]); return; }
      const { data } = await sb
        .from("user_inbox")
        .select("id, title, body, read_at, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (alive) setMessages((data as Msg[]) ?? []);
    })();
    return () => { alive = false; };
  }, []);

  async function markRead(id: string) {
    const sb = createClient();
    const now = new Date().toISOString();
    setMessages((prev) => prev?.map((m) => (m.id === id ? { ...m, read_at: now } : m)) ?? null);
    await sb.from("user_inbox").update({ read_at: now }).eq("id", id);
  }

  async function markAllRead() {
    const sb = createClient();
    const ids = messages?.filter((m) => !m.read_at).map((m) => m.id) ?? [];
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setMessages((prev) => prev?.map((m) => ({ ...m, read_at: m.read_at ?? now })) ?? null);
    await sb.from("user_inbox").update({ read_at: now }).in("id", ids);
  }

  if (messages === null) {
    return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3", fontSize: 13 }}>{t("loading")}</div>;
  }
  if (messages.length === 0) {
    return (
      <div style={{ padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
        <div style={{ color: "#8B8FA3", fontSize: 13 }}>
          {t("emptyBody")}
        </div>
      </div>
    );
  }

  const unread = messages.filter((m) => !m.read_at).length;

  if (open) {
    return (
      <div>
        <button
          onClick={() => setOpen(null)}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#22D1C3", fontSize: 12, padding: "6px 12px", borderRadius: 8,
            cursor: "pointer", marginBottom: 12,
          }}
        >
          {t("back")}
        </button>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#FFF", marginBottom: 6 }}>{open.title}</div>
        <div style={{ fontSize: 11, color: "#6c7590", marginBottom: 14 }}>
          {new Date(open.created_at).toLocaleString(dateLocale)}
        </div>
        <div style={{ fontSize: 13, color: "#dde3f5", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {open.body}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12 }}>
        <span style={{ color: "#8B8FA3" }}>
          {messages.length === 1 ? t("countOne", { n: 1 }) : t("countMany", { n: messages.length })}
          {unread > 0 && (
            <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "rgba(255,45,120,0.15)", color: "#FF2D78", fontWeight: 900, fontSize: 10 }}>
              {t("newBadge", { n: unread })}
            </span>
          )}
        </span>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ background: "transparent", border: "none", color: "#22D1C3", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            {t("markAll")}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m) => {
          const isUnread = !m.read_at;
          return (
            <button
              key={m.id}
              onClick={() => { setOpen(m); if (isUnread) void markRead(m.id); }}
              style={{
                textAlign: "left", cursor: "pointer", padding: 12, borderRadius: 12,
                background: isUnread ? "rgba(34,209,195,0.06)" : "rgba(26,29,35,0.7)",
                border: `1px solid ${isUnread ? "rgba(34,209,195,0.35)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ color: "#FFF", fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  {isUnread && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#22D1C3" }} />}
                  {m.title}
                </span>
                <span style={{ color: "#6c7590", fontSize: 10 }}>
                  {new Date(m.created_at).toLocaleDateString(dateLocale)}
                </span>
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {m.body}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

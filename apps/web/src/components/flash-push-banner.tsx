"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PushRow = {
  id: string;
  title: string;
  body: string;
  business_id: string;
  expires_at: string;
};

export function FlashPushBanner() {
  const sb = createClient();
  const [push, setPush] = useState<PushRow | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await sb
        .from("shop_push_messages")
        .select("id, title, body, business_id, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const first = data?.[0] as PushRow | undefined;
      if (first && !dismissed.has(first.id)) setPush(first);
      else setPush(null);
    }
    load();
    const int = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(int); };
  }, [sb, dismissed]);

  if (!push) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 900, maxWidth: 420, width: "calc(100vw - 32px)",
        padding: "12px 14px", borderRadius: 14,
        background: "linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,107,74,0.95))",
        color: "#0F1115",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 30px rgba(255,215,0,0.5)",
        display: "flex", alignItems: "flex-start", gap: 10,
        animation: "flashPushSlide 0.4s ease-out",
      }}
    >
      <span style={{ fontSize: 24 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>{push.title}</div>
        <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>{push.body}</div>
      </div>
      <button
        onClick={() => { setDismissed((s) => new Set(s).add(push.id)); setPush(null); }}
        style={{ background: "rgba(0,0,0,0.15)", border: "none", color: "#0F1115", cursor: "pointer", borderRadius: 999, width: 24, height: 24, fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-label="Schließen"
      >✕</button>
      <style>{`@keyframes flashPushSlide { from { transform: translate(-50%, -20px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }`}</style>
    </div>
  );
}

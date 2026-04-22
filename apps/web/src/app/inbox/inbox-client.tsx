"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  broadcast_id: string | null;
};

export function InboxClient({ initial }: { initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [open, setOpen] = useState<Msg | null>(null);
  const unreadCount = messages.filter((m) => !m.read_at).length;

  async function markRead(id: string) {
    const sb = createClient();
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read_at: now } : m)),
    );
    await sb.from("user_inbox").update({ read_at: now }).eq("id", id);
  }

  async function markAllRead() {
    const sb = createClient();
    const now = new Date().toISOString();
    const ids = messages.filter((m) => !m.read_at).map((m) => m.id);
    if (ids.length === 0) return;
    setMessages((prev) => prev.map((m) => ({ ...m, read_at: m.read_at ?? now })));
    await sb.from("user_inbox").update({ read_at: now }).in("id", ids);
  }

  if (messages.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl bg-[#1A1D23] border border-white/5">
        <div className="text-5xl mb-3">📭</div>
        <div className="text-sm text-[#8B8FA3]">
          Keine Nachrichten. Wir melden uns, wenn es etwas Spannendes gibt.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8B8FA3]">
          {messages.length} Nachricht{messages.length === 1 ? "" : "en"}
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[#FF2D78]/15 text-[#FF2D78] font-black">
              {unreadCount} NEU
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[#22D1C3] hover:underline"
          >
            Alle als gelesen markieren
          </button>
        )}
      </div>

      <div className="space-y-2">
        {messages.map((m) => {
          const unread = !m.read_at;
          return (
            <button
              key={m.id}
              onClick={() => {
                setOpen(m);
                if (unread) void markRead(m.id);
              }}
              className={`w-full text-left p-4 rounded-xl border transition ${
                unread
                  ? "bg-[#22D1C3]/5 border-[#22D1C3]/40 hover:border-[#22D1C3]/70"
                  : "bg-[#1A1D23] border-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-white flex items-center gap-2">
                  {unread && (
                    <span className="w-2 h-2 rounded-full bg-[#22D1C3]" />
                  )}
                  {m.title}
                </div>
                <span className="text-[10px] text-[#6c7590]">
                  {new Date(m.created_at).toLocaleDateString("de-DE")}
                </span>
              </div>
              <div className="text-xs text-[#a8b4cf] line-clamp-2">{m.body}</div>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-w-lg w-full bg-[#1A1D23] border border-white/10 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-black text-white">{open.title}</h2>
              <button
                onClick={() => setOpen(null)}
                className="text-[#8B8FA3] hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-[#6c7590] mb-4">
              {new Date(open.created_at).toLocaleString("de-DE")}
            </div>
            <div className="text-sm text-[#dde3f5] whitespace-pre-wrap leading-relaxed">
              {open.body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResourceArt, ResourceIcon, useUiIconArt, UiIcon, useInventoryItemArt } from "@/components/resource-icon";

type Counts = Record<string, { total: number; unread: number; subcategories?: Record<string, { total: number; unread: number }> }>;

type Msg = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  category: string;
  subcategory: string | null;
  kind: string | null;
  payload: unknown;
  is_starred: boolean;
  from_user_id: string | null;
  from_label: string | null;
  from_name: string | null;
  from_avatar: string | null;
  reward_payload: { wood?: number; stone?: number; gold?: number; mana?: number; speed_tokens?: number; gems?: number; items?: Array<{ item_id: string; count: number }> } | null;
  claimed_at: string | null;
};

type Category = "personal" | "report" | "crew" | "event" | "system" | "sent";

const CATEGORY_META: Record<Category, { label: string; icon: string; slot: string; subs?: Record<string, string> }> = {
  personal: { label: "Persönlich",  icon: "✉️", slot: "inbox_personal" },
  report:   { label: "Bericht",     icon: "📜", slot: "inbox_report",   subs: { pvp: "PvP", pve: "PvE", misc: "Sonstiges" } },
  crew:     { label: "Crew",        icon: "🛡️", slot: "inbox_crew",    subs: { decree: "Crew-Dekrete", announcement: "Bekanntmachungen", bounty: "Crew-Kopfgelder", build_report: "Bauberichte" } },
  event:    { label: "Events",      icon: "🎉", slot: "inbox_event" },
  system:   { label: "System",      icon: "⚙️", slot: "inbox_system" },
  sent:     { label: "Gesendet",    icon: "📤", slot: "inbox_sent" },
};

export function InboxClient() {
  const [counts, setCounts] = useState<Counts>({});
  const [category, setCategory] = useState<Category>("personal");
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const resourceArt = useResourceArt();
  const uiArt = useUiIconArt();

  const reloadCounts = useCallback(async () => {
    const r = await fetch("/api/inbox/counts", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); setCounts(j.counts ?? {}); }
  }, []);

  const reloadMessages = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ category });
    if (subcategory) params.set("subcategory", subcategory);
    if (showStarred) params.set("starred", "1");
    const r = await fetch(`/api/inbox?${params}`, { cache: "no-store" });
    if (r.ok) { const j = await r.json(); setMessages(j.messages ?? []); }
    setLoading(false);
  }, [category, subcategory, showStarred]);

  useEffect(() => { void reloadCounts(); }, [reloadCounts]);
  useEffect(() => { void reloadMessages(); }, [reloadMessages]);

  async function openMessage(m: Msg) {
    setSelected(m);
    if (!m.read_at) {
      await fetch("/api/inbox/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids: [m.id] }),
      });
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x));
      void reloadCounts();
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    await fetch("/api/inbox/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [selected.id] }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== selected.id));
    setSelected(null);
    void reloadCounts();
  }

  async function toggleStar() {
    if (!selected) return;
    const r = await fetch("/api/inbox/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "star", ids: [selected.id] }),
    });
    if (r.ok) {
      const j = await r.json();
      setSelected({ ...selected, is_starred: j.starred });
      setMessages((prev) => prev.map((m) => m.id === selected.id ? { ...m, is_starred: j.starred } : m));
    }
  }

  async function claimSelected() {
    if (!selected || !selected.reward_payload || selected.claimed_at) return;
    const r = await fetch("/api/inbox/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim", ids: [selected.id] }),
    });
    if (r.ok) {
      setSelected({ ...selected, claimed_at: new Date().toISOString() });
      setMessages((prev) => prev.map((m) => m.id === selected.id ? { ...m, claimed_at: new Date().toISOString() } : m));
    }
  }

  async function claimAll() {
    const r = await fetch("/api/inbox/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    if (r.ok) { void reloadMessages(); void reloadCounts(); }
  }

  async function deleteAllRead() {
    if (!confirm("Alle gelesenen (nicht gespeicherten) Nachrichten löschen?")) return;
    await fetch("/api/inbox/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_all_read", category }),
    });
    void reloadMessages(); void reloadCounts();
  }

  const subcatList = useMemo(() => CATEGORY_META[category].subs ?? null, [category]);
  const totalUnread = useMemo(() => Object.values(counts).reduce((s, c) => s + (c.unread ?? 0), 0), [counts]);

  return (
    <div className="ma365-inbox flex flex-row h-full min-h-[60vh] max-h-[80vh] overflow-hidden">
      <style jsx global>{`
        @keyframes ma365-pulse-badge {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,45,120,0.7); }
          50%      { box-shadow: 0 0 0 6px rgba(255,45,120,0); }
        }
        @keyframes ma365-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes ma365-slide-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ma365-glow-active {
          0%, 100% { box-shadow: inset 3px 0 0 0 #22D1C3, 0 0 12px -2px rgba(34,209,195,0.4); }
          50%      { box-shadow: inset 3px 0 0 0 #22D1C3, 0 0 18px 0 rgba(34,209,195,0.65); }
        }
        .ma365-cat-active { animation: ma365-glow-active 2.4s ease-in-out infinite; }
        .ma365-badge-pulse { animation: ma365-pulse-badge 1.8s infinite; }
        .ma365-msg-row { animation: ma365-slide-in 0.25s ease-out backwards; }
        .ma365-shimmer-wrap { position: relative; overflow: hidden; }
        .ma365-shimmer-wrap::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(34,209,195,0.18) 50%, transparent 65%);
          animation: ma365-shimmer 3.5s linear infinite;
          pointer-events: none;
        }
        .ma365-cat-btn { transition: background 0.2s, color 0.2s; }
        .ma365-msg-card { transition: background 0.18s, border-color 0.2s; }
      `}</style>
      {/* Sidebar — Kategorien (immer als schmale vertikale Spalte) */}
      <aside
        className="flex flex-col w-32 sm:w-44 shrink-0 border-r border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1A1D23 0%, #14171c 100%)" }}>
        <div className="hidden sm:block p-3 border-b border-white/10">
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <span>📬</span>
            <span style={{ color: "#22D1C3", textShadow: "0 0 12px rgba(34,209,195,0.5)" }}>Posteingang</span>
          </h1>
          {totalUnread > 0 && (
            <div className="text-[10px] text-[#FFD700] font-black mt-1 tracking-[1px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] ma365-badge-pulse" />
              {totalUnread} UNGELESEN
            </div>
          )}
        </div>
        <nav className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {(Object.keys(CATEGORY_META) as Category[]).map((c, idx) => {
            const meta = CATEGORY_META[c];
            const cnt = counts[c] ?? { total: 0, unread: 0 };
            const active = category === c;
            return (
              <button key={c}
                onClick={() => { setCategory(c); setSubcategory(null); setSelected(null); }}
                style={{ animationDelay: `${idx * 40}ms` }}
                title={meta.label}
                className={`ma365-cat-btn ma365-msg-row relative flex items-center gap-2 px-2 sm:px-3 py-3 text-left text-[12px] font-black border-b border-white/5 ${
                  active ? "ma365-cat-active ma365-shimmer-wrap bg-[#22D1C3]/12 text-white" : "text-white/55 hover:text-white hover:bg-white/5"
                }`}>
                <UiIcon slot={meta.slot} fallback={meta.icon} art={uiArt} size={20} />
                <span className="flex-1 tracking-wide truncate">{meta.label}</span>
                {cnt.unread > 0 && (
                  <span className="ma365-badge-pulse min-w-[18px] text-center px-1.5 py-0.5 rounded-full bg-[#FF2D78] text-white text-[9px] font-black">
                    {cnt.unread > 99 ? "99+" : cnt.unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="hidden sm:block p-2 border-t border-white/10 space-y-2">
          {(category === "personal" || category === "crew") && (
            <button onClick={() => setComposerOpen(true)}
              className="w-full text-[11px] font-black px-2 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115]">
              ✉️ Neue Nachricht
            </button>
          )}
          <a href="/karte" className="block text-center text-[10px] text-white/50 hover:text-white">← Karte</a>
        </div>
      </aside>

      {/* Hauptbereich — zeigt Liste ODER Detail (nicht beides, da Modal-Breite begrenzt) */}
      <section className={`${selected ? "hidden" : "flex"} flex-1 min-w-0 bg-[#0F1115] flex-col max-h-screen min-h-0`}>
        {/* Header mit Sub-Kategorien */}
        <div className="p-3 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-black text-white">{CATEGORY_META[category].label}</div>
            <button onClick={() => setShowStarred((v) => !v)}
              className={`text-[10px] font-black px-2 py-1 rounded ${showStarred ? "bg-[#FFD700] text-[#0F1115]" : "bg-white/5 text-white/60"}`}>
              ⭐ Gespeichert
            </button>
          </div>
          {subcatList && (
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setSubcategory(null)}
                className={`text-[10px] font-black px-2 py-1 rounded ${!subcategory ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-white/60"}`}>
                Alle
              </button>
              {Object.entries(subcatList).map(([id, label]) => {
                const sub = counts[category]?.subcategories?.[id];
                return (
                  <button key={id} onClick={() => setSubcategory(id)}
                    className={`text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 ${subcategory === id ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-white/60"}`}>
                    {label}
                    {sub?.unread ? <span className="px-1 rounded bg-[#FF2D78] text-white">{sub.unread}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-center text-[12px] text-white/40">Lade…</div>}
          {!loading && messages.length === 0 && (
            <div className="p-6 text-center text-[12px] text-white/40">Keine Nachrichten</div>
          )}
          {messages.map((m, idx) => {
            const meta = CATEGORY_META[m.category as Category] ?? CATEGORY_META.system;
            const isActive = selected?.id === m.id;
            const isUnread = !m.read_at;
            return (
              <button key={m.id} onClick={() => openMessage(m)}
                style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
                className={`ma365-msg-card ma365-msg-row w-full text-left px-3 py-3 border-b border-white/5 ${
                  isActive ? "bg-[#22D1C3]/15 border-l-2 border-l-[#22D1C3]" : "hover:bg-white/5 border-l-2 border-l-transparent"
                }`}>
                <div className="flex items-start gap-2.5">
                  <div className={`relative w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
                    isUnread ? "bg-gradient-to-br from-[#22D1C3]/30 to-[#FF2D78]/20 ring-1 ring-[#22D1C3]/50" : "bg-white/5"
                  }`}>
                    {m.from_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.from_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <UiIcon slot={meta.slot} fallback={meta.icon} art={uiArt} size={18} />
                    )}
                    {isUnread && (
                      <span className="ma365-badge-pulse absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF2D78] ring-2 ring-[#0F1115]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-[12px] truncate ${isUnread ? "text-white font-black" : "text-white/70"}`}>
                        {m.title}
                      </span>
                      {m.is_starred && <span className="text-[10px] text-[#FFD700] shrink-0">⭐</span>}
                    </div>
                    <div className="text-[10px] text-white/45 truncate mt-0.5">
                      {m.from_name && m.from_name !== "System" ? `${m.from_name} · ` : ""}
                      {fmtDate(m.created_at)}
                    </div>
                    {m.reward_payload && !m.claimed_at && (
                      <div className="text-[9px] text-[#FFD700] font-black mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FFD700]/10 border border-[#FFD700]/30">
                        🎁 Belohnung wartet
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer-Aktionen */}
        <div className="p-2 border-t border-white/10 shrink-0 flex gap-1">
          <button onClick={claimAll}
            className="flex-1 text-[10px] font-black px-2 py-2 rounded bg-[#FFD700]/20 text-[#FFD700]">
            🎁 Alles einsammeln
          </button>
          <button onClick={deleteAllRead}
            className="flex-1 text-[10px] font-black px-2 py-2 rounded bg-white/5 text-white/60">
            🗑 Gelesene löschen
          </button>
        </div>
      </section>

      {/* Detail-Spalte (nur sichtbar wenn Nachricht ausgewählt) */}
      <section className={`${selected ? "flex" : "hidden"} flex-1 min-w-0 bg-[#0F1115] flex-col max-h-screen min-h-0`}>
        {selected && (
          <MessageDetail
            msg={selected}
            resourceArt={resourceArt}
            uiArt={uiArt}
            onClose={() => setSelected(null)}
            onDelete={deleteSelected}
            onStar={toggleStar}
            onClaim={claimSelected}
          />
        )}
      </section>

      {composerOpen && (
        <ComposerModal kind={category === "crew" ? "crew" : "personal"} onClose={() => setComposerOpen(false)} onSent={() => { setComposerOpen(false); void reloadMessages(); void reloadCounts(); }} />
      )}
    </div>
  );
}

// ─── Detail-Renderer ────────────────────────────────────────────────
function MessageDetail({ msg, resourceArt, uiArt, onClose, onDelete, onStar, onClaim }: {
  msg: Msg;
  resourceArt: ReturnType<typeof useResourceArt>;
  uiArt: ReturnType<typeof useUiIconArt>;
  onClose: () => void;
  onDelete: () => void;
  onStar: () => void;
  onClaim: () => void;
}) {
  return (
    <>
      <div className="relative border-b border-white/10 shrink-0 ma365-shimmer-wrap"
        style={{
          background: "linear-gradient(135deg, rgba(34,209,195,0.18) 0%, rgba(15,17,21,0.6) 50%, rgba(255,45,120,0.12) 100%)",
        }}>
        <div className="p-3 lg:p-4 flex items-start gap-3 relative z-10">
          <button onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white text-lg font-black flex items-center justify-center transition"
            title="Zurück">
            ←
          </button>
          {msg.from_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.from_avatar} alt="" className="w-11 h-11 lg:w-12 lg:h-12 rounded-full ring-2 ring-[#22D1C3]/40 shrink-0" />
          ) : (
            <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-full shrink-0 flex items-center justify-center ring-2 ring-[#22D1C3]/40"
              style={{ background: "linear-gradient(135deg, rgba(34,209,195,0.35), rgba(255,45,120,0.25))" }}>
              <UiIcon
                slot={CATEGORY_META[msg.category as Category]?.slot ?? "inbox_fab"}
                fallback={CATEGORY_META[msg.category as Category]?.icon ?? "📬"}
                art={uiArt}
                size={26}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm lg:text-base font-black text-white leading-tight break-words">{msg.title}</div>
            <div className="text-[10px] text-white/60 mt-1 flex flex-wrap items-center gap-1.5">
              <span className="font-black text-[#22D1C3]">{msg.from_name ?? "System"}</span>
              <span className="text-white/30">·</span>
              <span>{fmtDate(msg.created_at)}</span>
              {msg.is_starred && <span className="text-[#FFD700]">⭐</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Body — entweder strukturierter Renderer oder Plain-Text */}
        {msg.kind === "battle_report" || msg.kind === "rally_report"
          ? <BattleReportView msg={msg} resourceArt={resourceArt} />
          : msg.kind === "spy_report"
          ? <SpyReportView msg={msg} resourceArt={resourceArt} />
          : msg.reward_payload
          ? <SystemRewardView msg={msg} resourceArt={resourceArt} onClaim={onClaim} />
          : <div className="text-[13px] text-white/85 whitespace-pre-wrap leading-relaxed">{msg.body}</div>}
      </div>

      <div className="p-3 border-t border-white/10 shrink-0 flex gap-2">
        <button onClick={onStar}
          className={`flex-1 text-[11px] font-black px-3 py-2.5 rounded ${msg.is_starred ? "bg-[#FFD700] text-[#0F1115]" : "bg-white/5 text-white/70"}`}>
          {msg.is_starred ? "⭐ Gespeichert" : "☆ Speichern"}
        </button>
        <button onClick={onDelete}
          className="flex-1 text-[11px] font-black px-3 py-2.5 rounded bg-[#FF2D78]/15 text-[#FF6B9A]">
          🗑 Löschen
        </button>
      </div>
    </>
  );
}

// ─── Renderer: BattleReport ─────────────────────────────────────────
function BattleReportView({ msg, resourceArt }: { msg: Msg; resourceArt: ReturnType<typeof useResourceArt> }) {
  // Body ist Klartext — extrahiere Werte heuristisch falls payload fehlt.
  return (
    <div className="space-y-3">
      <div className="text-[13px] text-white/85 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
      {/* Zukünftig: msg.payload mit strukturierten Werten rendern */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {(() => { void resourceArt; return null; })()}
    </div>
  );
}

// ─── Renderer: SpyReport ────────────────────────────────────────────
function SpyReportView({ msg, resourceArt }: { msg: Msg; resourceArt: ReturnType<typeof useResourceArt> }) {
  return (
    <div className="space-y-3">
      <div className="text-[13px] text-white/85 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {(() => { void resourceArt; return null; })()}
    </div>
  );
}

// ─── Renderer: SystemReward ─────────────────────────────────────────
function SystemRewardView({ msg, resourceArt, onClaim }: { msg: Msg; resourceArt: ReturnType<typeof useResourceArt>; onClaim: () => void }) {
  const r = msg.reward_payload ?? {};
  const inventoryArt = useInventoryItemArt();
  const rss = [
    { k: "wood",  label: "Tech-Schrott", v: r.wood ?? 0,  fb: "⚙️" },
    { k: "stone", label: "Komponenten",  v: r.stone ?? 0, fb: "🔩" },
    { k: "gold",  label: "Krypto",       v: r.gold ?? 0,  fb: "💸" },
    { k: "mana",  label: "Bandbreite",   v: r.mana ?? 0,  fb: "📡" },
  ].filter((x) => x.v > 0);
  const tokens = r.speed_tokens ?? 0;
  const gems = r.gems ?? 0;
  const items = (r.items ?? []).filter((i) => i?.item_id);
  const claimed = !!msg.claimed_at;
  // Render markdown-light: **bold**
  const bodyParts = msg.body.split(/(\*\*[^*]+\*\*)/g);

  // Hero-Header je Kind
  const kindMeta = (() => {
    const p = (msg.payload ?? {}) as { emoji?: string; label?: string };
    const k = msg.kind ?? "";
    if (k === "link_bonus") return { emoji: p.emoji ?? "🎁", color: "#22D1C3", label: p.label ?? "Verknüpfungs-Bonus" };
    if (k === "maintenance") return { emoji: "🔧", color: "#FFD700", label: "Wartungs-Kompensation" };
    if (k === "royal_chest") return { emoji: "👑", color: "#FFD700", label: "Königliche Truhe" };
    if (k === "lore_set") return { emoji: "📜", color: "#a855f7", label: "Lore-Set vervollständigt" };
    if (k === "crypto_drop") return { emoji: "💸", color: "#4ade80", label: "Krypto-Drop" };
    if (k === "activity_reward") return { emoji: "📊", color: "#22D1C3", label: "Aktivitäts-Belohnung" };
    return { emoji: "🎁", color: "#FFD700", label: "Belohnung" };
  })();

  return (
    <div className="space-y-3">
      {/* Hero-Header */}
      <div className="rounded-xl p-3 flex items-center gap-3"
           style={{ background: `linear-gradient(135deg, ${kindMeta.color}22, transparent)`, border: `1px solid ${kindMeta.color}44` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
             style={{ background: `${kindMeta.color}33`, border: `1.5px solid ${kindMeta.color}` }}>
          {kindMeta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black tracking-[1.5px]" style={{ color: kindMeta.color }}>{kindMeta.label.toUpperCase()}</div>
          <div className="text-[14px] font-black text-white">{msg.title}</div>
        </div>
      </div>
      {/* Body mit **bold** Support */}
      <div className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap">
        {bodyParts.map((part, i) => part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>)}
      </div>
      {(rss.length > 0 || tokens > 0 || gems > 0 || items.length > 0) && (
        <div className="rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 p-3 space-y-2">
          <div className="text-[10px] font-black tracking-[1.5px] text-[#FFD700]">🎁 BELOHNUNG</div>
          <div className="flex flex-wrap gap-2">
            {gems > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FF2D78]/15 border border-[#FF2D78]/40">
                <span className="text-lg">💎</span>
                <span className="text-[12px] font-black text-white">+{gems.toLocaleString("de-DE")}</span>
              </div>
            )}
            {rss.map((it) => (
              <div key={it.k} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10">
                <ResourceIcon kind={it.k as "wood"|"stone"|"gold"|"mana"} size={20} fallback={it.fb} art={resourceArt} />
                <span className="text-[12px] font-black text-white">+{it.v.toLocaleString("de-DE")}</span>
              </div>
            ))}
            {tokens > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/40">
                <span className="text-lg">⚡</span>
                <span className="text-[12px] font-black text-[#FFD700]">+{tokens}</span>
              </div>
            )}
            {items.map((it) => {
              const art = inventoryArt[it.item_id];
              return (
                <div key={it.item_id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#a855f7]/12 border border-[#a855f7]/40">
                  {art?.image_url
                    ? <img src={art.image_url} alt="" style={{ width: 22, height: 22, objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                    : <span className="text-lg">📦</span>}
                  <span className="text-[12px] font-black text-white">×{it.count}</span>
                </div>
              );
            })}
          </div>
          <button onClick={onClaim} disabled={claimed}
            className="w-full text-[11px] font-black px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF9E2C] text-[#0F1115] disabled:opacity-40 disabled:from-[#444] disabled:to-[#444]">
            {claimed ? "✓ Eingesammelt" : "🎁 Einsammeln"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Composer ───────────────────────────────────────────────────────
function ComposerModal({ kind, onClose, onSent }: {
  kind: "personal" | "crew";
  onClose: () => void;
  onSent: () => void;
}) {
  const [toUser, setToUser] = useState("");
  const [subcategory, setSubcategory] = useState<string>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/inbox/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, to_user: toUser || undefined,
          subcategory: kind === "crew" ? subcategory : undefined,
          title, body,
        }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { onSent(); }
      else setMsg(j.error ?? "Senden fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        style={{ background: "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)" }}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="text-base">{kind === "crew" ? "🛡️" : "✉️"}</div>
          <div className="flex-1 text-base font-black text-white">
            {kind === "crew" ? "Crew-Nachricht posten" : "Persönliche Nachricht"}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-black/40 text-white text-base font-black">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {kind === "personal" ? (
            <div>
              <label className="text-[10px] font-black text-white/55 tracking-[1px]">EMPFÄNGER (User-ID)</label>
              <input value={toUser} onChange={(e) => setToUser(e.target.value)}
                placeholder="UUID des Empfängers"
                className="w-full mt-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-[12px] font-mono" />
              <div className="text-[9px] text-white/40 mt-1">Hinweis: User-Suche per Name kommt später; vorerst UUID nutzen.</div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black text-white/55 tracking-[1px]">KATEGORIE</label>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-[12px]">
                <option value="announcement">Crew-Bekanntmachung</option>
                <option value="decree">Crew-Dekret</option>
                <option value="bounty">Crew-Kopfgeld</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] font-black text-white/55 tracking-[1px]">BETREFF</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              className="w-full mt-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-[13px] font-black" />
          </div>
          <div>
            <label className="text-[10px] font-black text-white/55 tracking-[1px]">NACHRICHT</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
              className="w-full mt-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-[12px] resize-none" />
          </div>
          {msg && <div className="text-[11px] font-black text-[#FF6B9A]">{msg}</div>}
        </div>

        <div className="p-3 border-t border-white/10">
          <button onClick={send} disabled={busy || !title.trim() || !body.trim() || (kind === "personal" && !toUser.trim())}
            className="w-full text-[12px] font-black px-4 py-2.5 rounded-xl text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #22D1C3, #5ddaf0)", boxShadow: "0 4px 14px rgba(34,209,195,0.35)" }}>
            {busy ? "…" : kind === "crew" ? "📣 An Crew posten" : "✉️ Senden"}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  if (diff < 7 * 86400) return `vor ${Math.floor(diff / 86400)} T.`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

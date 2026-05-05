"use client";

// Collapsible Admin-Sidebar mit Auto-Expand der aktuellen Gruppe.
// Erst-Render: nur die Gruppe die zum aktuellen Pfad passt ist offen + Dashboard.
// User kann andere Gruppen aufklappen, State wird in localStorage persistiert.
// Inline-Search filtert Items live (alternativ zu Cmd+K für maus-fokussierte
// Workflows).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = { href: string; label: string };
type NavGroup = { id: string; title: string; emoji: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    id: "community", emoji: "👥", title: "Community",
    items: [
      { href: "/admin/runners",      label: "🏃 Spieler" },
      { href: "/admin/crews",        label: "👥 Crews" },
      { href: "/admin/territories",  label: "🗺️ Territorien" },
      { href: "/admin/moderation",   label: "⚖️ Moderation" },
      { href: "/admin/support",      label: "🎫 Support-Tickets" },
      { href: "/admin/user-media",   label: "📸 User-Media" },
    ],
  },
  {
    id: "business", emoji: "💼", title: "Business",
    items: [
      { href: "/admin/sales",    label: "💰 Vertrieb & Umsatz" },
      { href: "/admin/refunds",  label: "💸 Refunds" },
    ],
  },
  {
    id: "marketing", emoji: "📢", title: "Marketing & Growth",
    items: [
      { href: "/admin/marketing",         label: "📧 Marketing-Hub" },
      { href: "/admin/marketing/cohorts", label: "🧮 Cohort-Builder" },
      { href: "/admin/marketing/churn",   label: "📉 Churn-Risiko" },
      { href: "/admin/banners",           label: "📢 In-App-Banner" },
      { href: "/admin/events",            label: "🎉 Event-Trigger" },
      { href: "/admin/broadcasts",        label: "📣 Broadcasts" },
    ],
  },
  {
    id: "game", emoji: "🎮", title: "Game-Design",
    items: [
      { href: "/admin/gamification",   label: "🏆 Gamification" },
      { href: "/admin/missions",       label: "🎯 Missionen" },
      { href: "/admin/seasons",        label: "🗓️ Saisons" },
      { href: "/admin/saga",           label: "🏙️ Metropol-Saga" },
      { href: "/admin/experiments",    label: "🧪 A/B-Tests" },
      { href: "/admin/artwork",        label: "🎨 Artwork" },
      { href: "/admin/lights-preview", label: "✨ Lights Preview" },
    ],
  },
  {
    id: "system", emoji: "⚙️", title: "System",
    items: [
      { href: "/admin/flags",            label: "🚩 Feature-Flags" },
      { href: "/admin/security",         label: "🔐 Security Center" },
      { href: "/admin/audit",            label: "📋 Audit-Log" },
      { href: "/admin/system",           label: "⚙️ System" },
      { href: "/admin/system-messages",  label: "📬 System-Nachrichten" },
    ],
  },
];

const STORAGE_KEY = "ma365_admin_nav_open_v1";

function findGroupForPath(path: string): string | null {
  // beste Übereinstimmung = längster matchender prefix
  let best: { id: string; len: number } | null = null;
  for (const g of NAV) {
    for (const it of g.items) {
      if (path === it.href || path.startsWith(it.href + "/")) {
        if (!best || it.href.length > best.len) best = { id: g.id, len: it.href.length };
      }
    }
  }
  return best?.id ?? null;
}

export function AdminNav() {
  const pathname = usePathname() || "/admin";
  const currentGroup = useMemo(() => findGroupForPath(pathname), [pathname]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");

  // Hydration: localStorage lesen + aktuelle Gruppe garantiert auf
  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch { /* invalid json, ignore */ }
    if (currentGroup) stored[currentGroup] = true;
    setOpen(stored);
    setHydrated(true);
    // currentGroup-Effekt triggert beim Path-Wechsel separat (siehe unten)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn der Pfad wechselt: aktuelle Gruppe sicher öffnen (ohne andere zu schließen)
  useEffect(() => {
    if (!hydrated || !currentGroup) return;
    setOpen((o) => (o[currentGroup] ? o : { ...o, [currentGroup]: true }));
  }, [pathname, currentGroup, hydrated]);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(open)); } catch { /* quota */ }
  }, [open, hydrated]);

  function toggle(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  function expandAll() { setOpen(Object.fromEntries(NAV.map((g) => [g.id, true]))); }
  function collapseAll() {
    const next = Object.fromEntries(NAV.map((g) => [g.id, false]));
    if (currentGroup) next[currentGroup] = true;
    setOpen(next);
  }

  // Search-Filter: leerer Search → normale Anzeige; sonst alle Gruppen
  // mit Treffern auto-aufklappen, Items ohne Match ausblenden.
  const searchActive = search.trim().length > 0;
  const q = search.trim().toLowerCase();
  const filteredNav: NavGroup[] = useMemo(() => {
    if (!searchActive) return NAV;
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((it) => it.label.toLowerCase().includes(q) || it.href.includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [searchActive, q]);

  return (
    <>
      {/* Dashboard immer sichtbar als Top-Level */}
      <Link
        href="/admin"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${pathname === "/admin"
          ? "bg-[#22D1C3]/15 text-[#22D1C3]"
          : "text-[#dde3f5] hover:bg-white/5 hover:text-white"}`}
      >
        <span>📊</span><span>Dashboard</span>
      </Link>

      {/* Inline-Search */}
      <div className="px-1 mt-2">
        <input
          type="search"
          placeholder="Filtern…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-[#6c7590] focus:outline-none focus:border-[#22D1C3]/50"
        />
      </div>

      {/* Expand/Collapse-Toggle (nur wenn nicht im Search-Modus) */}
      {!searchActive && (
        <div className="flex items-center justify-end gap-2 px-1 text-[10px] text-[#6c7590]">
          <button onClick={expandAll} className="hover:text-white">alle ▾</button>
          <span>·</span>
          <button onClick={collapseAll} className="hover:text-white">alle ▸</button>
        </div>
      )}

      {/* Groups */}
      <div className="space-y-1">
        {filteredNav.map((group) => {
          const isOpen = searchActive ? true : !!open[group.id];
          const hasActive = currentGroup === group.id;
          return (
            <div key={group.id}>
              <button
                onClick={() => !searchActive && toggle(group.id)}
                disabled={searchActive}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-[0.1em] uppercase transition-colors ${hasActive ? "text-[#22D1C3]" : "text-[#8b9bbf] hover:text-white"}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{group.emoji}</span>
                  <span>{group.title}</span>
                  {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-[#22D1C3]" />}
                </span>
                {!searchActive && (
                  <span className={`text-[#6c7590] transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                )}
              </button>
              {isOpen && (
                <div className="space-y-0.5 ml-1 mt-0.5 pl-2 border-l border-white/5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${active
                          ? "bg-[#22D1C3]/15 text-[#22D1C3] font-bold"
                          : "text-[#c4cbe0] hover:bg-white/5 hover:text-white"}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {searchActive && filteredNav.length === 0 && (
          <div className="text-xs text-[#6c7590] px-3 py-4 text-center">Keine Treffer für „{search}"</div>
        )}
      </div>
    </>
  );
}

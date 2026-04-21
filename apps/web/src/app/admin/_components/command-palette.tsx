"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { kind: string; id: string; title: string; subtitle: string; href: string };

const KIND_META: Record<string, { icon: string; color: string }> = {
  runner: { icon: "🏃", color: "#22D1C3" },
  shop:   { icon: "🏪", color: "#FF6B4A" },
  crew:   { icon: "👥", color: "#a855f7" },
  ticket: { icon: "🎫", color: "#FFD700" },
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const metaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (metaK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter" && results[active]) {
        e.preventDefault();
        router.push(results[active].href);
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, router]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  useEffect(() => {
    if (!open || q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      const j = await res.json();
      setResults(j.results ?? []);
      setActive(0);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 pt-[15vh]"
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-[#151922] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Suche Runner · Shops · Crews · Tickets … (⌘K)"
          className="w-full px-4 py-4 bg-transparent text-white text-base outline-none border-b border-white/10"
        />
        <div className="max-h-[50vh] overflow-y-auto">
          {q.length < 2 ? (
            <div className="p-6 text-sm text-[#8B8FA3] text-center">Mindestens 2 Zeichen eingeben.</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-sm text-[#8B8FA3] text-center">Keine Treffer.</div>
          ) : (
            results.map((r, i) => {
              const meta = KIND_META[r.kind] ?? { icon: "📎", color: "#8B8FA3" };
              return (
                <button key={`${r.kind}-${r.id}`}
                  onClick={() => { router.push(r.href); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-0 ${
                    i === active ? "bg-[#22D1C3]/10" : "hover:bg-white/5"
                  }`}>
                  <div className="text-lg">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{r.title}</div>
                    <div className="text-xs text-[#8B8FA3] truncate">{r.subtitle}</div>
                  </div>
                  <div className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full"
                    style={{ background: `${meta.color}22`, color: meta.color }}>{r.kind}</div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 text-[10px] text-[#6c7590] border-t border-white/5 flex gap-3">
          <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded">↑↓</kbd> Navigieren</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded">⏎</kbd> Öffnen</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/5 rounded">Esc</kbd> Schließen</span>
        </div>
      </div>
    </div>
  );
}

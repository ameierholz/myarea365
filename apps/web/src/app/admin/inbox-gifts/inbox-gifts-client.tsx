"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, PageTitle, Select, Textarea } from "../_components/ui";

type Recipient = { id: string; label: string; subtitle: string };
type CatalogItem = {
  catalog_id: string;
  name: string;
  emoji: string;
  image_url: string | null;
  category: string;
  rarity: string;
};
type SelectedItem = { catalog_id: string; count: number; name: string; emoji: string };

const CATEGORY_LABEL: Record<string, string> = {
  chest: "Truhen", speedup: "Beschleuniger", boost: "Boosts", elixir: "Elixiere",
  token: "Tokens", key: "Schlüssel", guardian_xp: "Wächter-EP",
};
const RARITY_COLOR: Record<string, string> = {
  common: "#a8b4cf", rare: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
};

export function InboxGiftsClient() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");

  const [res, setRes] = useState({ wood: 0, stone: 0, gold: 0, mana: 0, gems: 0, speed_tokens: 0 });

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<string>("all");
  const [selected, setSelected] = useState<SelectedItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Catalog laden
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/inbox-gifts").then((r) => r.json()).then((j) => {
      if (!cancelled && j.items) setCatalog(j.items as CatalogItem[]);
    });
    return () => { cancelled = true; };
  }, []);

  // Empfänger-Search (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const j = await r.json();
        type SearchItem = { kind: string; id: string; title: string; subtitle: string };
        const rows: SearchItem[] = (j.results ?? []) as SearchItem[];
        setSearchResults(rows.filter((x) => x.kind === "runner").map((x) => ({
          id: x.id, label: x.title, subtitle: x.subtitle,
        })));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function addRecipient(r: Recipient) {
    if (recipients.some((x) => x.id === r.id)) return;
    setRecipients((prev) => [...prev, r]);
    setSearchQuery("");
    setSearchResults([]);
  }
  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((x) => x.id !== id));
  }

  function addItem(it: CatalogItem) {
    setSelected((prev) => {
      const existing = prev.find((x) => x.catalog_id === it.catalog_id);
      if (existing) {
        return prev.map((x) => x.catalog_id === it.catalog_id ? { ...x, count: x.count + 1 } : x);
      }
      return [...prev, { catalog_id: it.catalog_id, count: 1, name: it.name, emoji: it.emoji }];
    });
  }
  function setItemCount(catalog_id: string, count: number) {
    if (count <= 0) {
      setSelected((prev) => prev.filter((x) => x.catalog_id !== catalog_id));
      return;
    }
    setSelected((prev) => prev.map((x) => x.catalog_id === catalog_id ? { ...x, count } : x));
  }

  const filteredCatalog = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    return catalog
      .filter((c) => catalogCategory === "all" || c.category === catalogCategory)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.catalog_id.toLowerCase().includes(q));
  }, [catalog, catalogFilter, catalogCategory]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    catalog.forEach((c) => s.add(c.category));
    return Array.from(s).sort();
  }, [catalog]);

  const hasAnyReward = useMemo(() => {
    return Object.values(res).some((v) => v > 0) || selected.length > 0;
  }, [res, selected]);

  async function send() {
    if (recipients.length === 0) { setResult({ kind: "err", msg: "Mindestens 1 Empfänger wählen" }); return; }
    if (!title.trim()) { setResult({ kind: "err", msg: "Title fehlt" }); return; }
    if (!body.trim()) { setResult({ kind: "err", msg: "Body fehlt" }); return; }
    if (!reason.trim()) { setResult({ kind: "err", msg: "Grund (Audit) fehlt" }); return; }
    setSubmitting(true); setResult(null);
    try {
      const r = await fetch("/api/admin/inbox-gifts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_ids: recipients.map((x) => x.id),
          title: title.trim(),
          body: body.trim(),
          resources: res,
          items: selected.map((s) => ({ catalog_id: s.catalog_id, count: s.count })),
          reason: reason.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setResult({ kind: "err", msg: j.error ?? "Unbekannter Fehler" });
      } else {
        setResult({ kind: "ok", msg: `✓ An ${j.sent_count ?? recipients.length} Empfänger gesendet` });
        // Form reset (Empfänger bleibt, falls noch mehr zu senden)
        setTitle(""); setBody(""); setReason("");
        setRes({ wood: 0, stone: 0, gold: 0, mana: 0, gems: 0, speed_tokens: 0 });
        setSelected([]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageTitle
        title="Inbox-Geschenke"
        subtitle="Entschädigungen, Geschenke oder manuelle Belohnungen an Spieler senden — mit beliebiger Item- und Ressourcen-Kombination."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Linke Spalte: Empfänger + Inhalt ── */}
        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3] mb-3">1 · Empfänger</div>
          <div className="relative mb-3">
            <Input
              placeholder="Nach Username, Display-Name oder E-Mail suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0F1115] border border-white/10 rounded-lg overflow-hidden z-10 max-h-60 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addRecipient(r)}
                    className="block w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <div className="text-sm font-bold text-white">{r.label}</div>
                    <div className="text-[10px] text-[#8b8fa3]">{r.subtitle}</div>
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="text-[10px] text-[#8b8fa3] mt-1">suche…</div>}
          </div>
          <div className="flex flex-wrap gap-2 mb-4 min-h-[28px]">
            {recipients.length === 0 && <div className="text-xs text-[#8b8fa3] py-1">Keine Empfänger ausgewählt</div>}
            {recipients.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-[#22D1C3]/10 border border-[#22D1C3]/30 rounded-lg pl-2 pr-1 py-0.5">
                <span className="text-xs text-white font-bold">{r.label}</span>
                <button onClick={() => removeRecipient(r.id)} className="text-[#8b8fa3] hover:text-[#FF2D78] text-sm px-1">×</button>
              </div>
            ))}
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3] mb-2">2 · Inhalt</div>
          <label className="text-[10px] text-[#8b8fa3]">Title (Pattern: <code className="text-[#22D1C3]">🎁 WAS · WOHER · WARUM</code>)</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="🎁 +500 Diamanten · Wartung · Server-Ausfall 12.05."
            className="mb-2"
          />
          <label className="text-[10px] text-[#8b8fa3]">Body (Markdown: **bold** wird unterstützt)</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hallo, als Entschädigung für den Server-Ausfall am 12.05. erhältst du **500 Diamanten** und ein paar Boost-Items."
            rows={4}
            className="mb-3"
          />
          <label className="text-[10px] text-[#8b8fa3]">Grund (Audit-Log)</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z.B. Server-Ausfall 12.05.2026, Bug-Wiedergutmachung Ticket #42"
          />
        </Card>

        {/* ── Rechte Spalte: Resources + Items ── */}
        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3] mb-3">3 · Ressourcen (optional)</div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ResourceField label="⚙️ Schrott" value={res.wood} onChange={(n) => setRes({ ...res, wood: n })} />
            <ResourceField label="🔩 Komp." value={res.stone} onChange={(n) => setRes({ ...res, stone: n })} />
            <ResourceField label="💸 Krypto" value={res.gold} onChange={(n) => setRes({ ...res, gold: n })} />
            <ResourceField label="📡 Bandb." value={res.mana} onChange={(n) => setRes({ ...res, mana: n })} />
            <ResourceField label="💎 Diam." value={res.gems} onChange={(n) => setRes({ ...res, gems: n })} />
            <ResourceField label="⚡ Speed" value={res.speed_tokens} onChange={(n) => setRes({ ...res, speed_tokens: n })} />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3] mb-2">4 · Items (optional)</div>

          {selected.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {selected.map((s) => (
                <div key={s.catalog_id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2">
                  <span className="text-lg">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{s.name}</div>
                    <div className="text-[9px] text-[#8b8fa3] font-mono">{s.catalog_id}</div>
                  </div>
                  <input
                    type="number" min={1}
                    value={s.count}
                    onChange={(e) => setItemCount(s.catalog_id, parseInt(e.target.value || "0", 10))}
                    className="w-16 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-sm text-white text-right"
                  />
                  <button onClick={() => setItemCount(s.catalog_id, 0)} className="text-[#8b8fa3] hover:text-[#FF2D78] px-1">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Item suchen…"
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              className="flex-1"
            />
            <Select value={catalogCategory} onChange={(e) => setCatalogCategory(e.target.value)}>
              <option value="all">Alle Kategorien</option>
              {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
            </Select>
          </div>

          <div className="max-h-72 overflow-y-auto border border-white/10 rounded-lg divide-y divide-white/5">
            {filteredCatalog.length === 0 && <div className="text-xs text-[#8b8fa3] p-3 text-center">Keine Items im Filter</div>}
            {filteredCatalog.slice(0, 50).map((c) => (
              <button
                key={c.catalog_id}
                onClick={() => addItem(c)}
                className="w-full flex items-center gap-2 p-2 hover:bg-white/[0.03] transition-colors text-left"
              >
                {c.image_url
                  ? <img src={c.image_url} alt="" className="w-8 h-8 object-contain" />
                  : <span className="text-xl w-8 text-center">{c.emoji}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{c.name}</div>
                  <div className="text-[9px] text-[#8b8fa3] font-mono">{c.catalog_id}</div>
                </div>
                <Badge tone="neutral">{CATEGORY_LABEL[c.category] ?? c.category}</Badge>
                <span style={{ color: RARITY_COLOR[c.rarity] ?? "#a8b4cf" }} className="text-[10px] font-bold uppercase">{c.rarity}</span>
              </button>
            ))}
            {filteredCatalog.length > 50 && (
              <div className="text-[10px] text-[#8b8fa3] p-2 text-center">… {filteredCatalog.length - 50} weitere, eingrenzen mit Filter</div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Submit ── */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-xs text-[#8b8fa3]">
          {recipients.length} Empfänger · {hasAnyReward ? "Belohnung enthalten" : "Info-Nachricht (kein Reward)"}
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <div className={result.kind === "ok" ? "text-xs text-[#4ade80]" : "text-xs text-[#FF2D78]"}>{result.msg}</div>
          )}
          <Button onClick={send} disabled={submitting || recipients.length === 0}>
            {submitting ? "Sende…" : `Senden an ${recipients.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResourceField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[9px] text-[#8b8fa3] block mb-0.5">{label}</span>
      <input
        type="number" min={0}
        value={value || ""}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white"
        placeholder="0"
      />
    </label>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

const PRIMARY = "#22D1C3";

type Props = {
  /** Original-Text der übersetzt werden soll */
  text: string;
  /** Sprache des Original-Textes (ISO 639-1, z.B. "de"). Wenn leer/gleich Browser-Sprache → Button versteckt. */
  sourceLang?: string | null;
  /** Ziel-Sprache (ISO 639-1). Default: navigator.language (Browser-Locale). */
  targetLang?: string;
  /** Stilvariante: "inline" für DM/Marker, "block" für Inbox-Detail */
  variant?: "inline" | "block";
  /** Optional: gerendert werden soll der übersetzte Text inline statt unterhalb (für Marker-DOM) */
  renderInline?: boolean;
};

/**
 * Klein-Button (🌐) der bei Klick einen User-Text in die Browser-Sprache übersetzt
 * und das Ergebnis unter dem Original anzeigt. Cached pro Aufruf serverseitig.
 *
 * Wird automatisch ausgeblendet wenn `sourceLang` fehlt oder bereits der
 * Ziel-Sprache entspricht.
 */
export function TranslateButton({
  text, sourceLang, targetLang, variant = "inline",
}: Props) {
  const browserLang = useMemo(() => {
    if (typeof navigator === "undefined") return "de";
    return (navigator.language || "de").toLowerCase().split("-")[0];
  }, []);

  const target = (targetLang || browserLang).toLowerCase().split("-")[0];
  const source = (sourceLang || "").toLowerCase().split("-")[0];

  const [state, setState] = useState<"idle" | "loading" | "shown" | "error">("idle");
  const [translated, setTranslated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wenn Quell- = Zielsprache oder Quelle unbekannt → Button gar nicht rendern
  if (!source || !target || source === target || !text.trim()) return null;

  const handleClick = async () => {
    if (state === "shown") {
      // Toggle zurück auf Original
      setState("idle");
      return;
    }
    setState("loading"); setError(null);
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source_lang: source, target_lang: target }),
      });
      const j = await r.json() as { translated?: string; error?: string };
      if (!r.ok || !j.translated) throw new Error(j.error ?? "translate_failed");
      setTranslated(j.translated);
      setState("shown");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 4,
    padding: variant === "block" ? "4px 8px" : "2px 6px",
    borderRadius: 999,
    border: `1px solid ${PRIMARY}55`,
    background: state === "shown" ? `${PRIMARY}33` : `${PRIMARY}14`,
    color: PRIMARY,
    fontSize: variant === "block" ? 11 : 10,
    fontWeight: 700,
    letterSpacing: 0.3,
    cursor: state === "loading" ? "wait" : "pointer",
    lineHeight: 1,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        style={buttonStyle}
        title={state === "shown" ? "Original anzeigen" : `In ${target.toUpperCase()} übersetzen`}
      >
        🌐 {state === "loading" ? "…" : state === "shown" ? "Original" : target.toUpperCase()}
      </button>
      {state === "shown" && translated && (
        <div style={{
          marginTop: 6,
          padding: "6px 10px",
          borderRadius: 8,
          background: `${PRIMARY}1f`,
          border: `1px solid ${PRIMARY}55`,
          fontSize: variant === "block" ? 13 : 12,
          color: "#FFF",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}>
          {translated}
        </div>
      )}
      {state === "error" && error && (
        <div style={{
          marginTop: 4,
          fontSize: 10,
          color: "#FF6B4A",
        }}>
          ⚠️ {error === "rate_limited" ? "Tageslimit erreicht" : "Übersetzung fehlgeschlagen"}
        </div>
      )}
    </>
  );
}

/**
 * Vanilla-JS-Version für DOM-basierte Marker (innerHTML). Bindet einen
 * Click-Handler an `[data-translate-target]`-Elemente und ruft `/api/translate`
 * auf. Wird einmalig in der Map-Komponente initialisiert.
 *
 * Erwartetes Markup:
 *   <span class="ma365-translate-btn" data-translate-text="..." data-translate-src="de">🌐</span>
 *   <span class="ma365-translate-target" data-original="Original-Text"></span>
 *
 * Funktion liefert eine Cleanup-Function zurück.
 */
export function attachVanillaTranslate(rootEl: HTMLElement, browserLang: string): () => void {
  const onClick = async (ev: MouseEvent) => {
    const btn = (ev.target as HTMLElement)?.closest(".ma365-translate-btn") as HTMLElement | null;
    if (!btn) return;
    ev.stopPropagation();
    ev.preventDefault();

    const text = btn.getAttribute("data-translate-text") || "";
    const src = (btn.getAttribute("data-translate-src") || "de").toLowerCase().split("-")[0];
    const target = browserLang.toLowerCase().split("-")[0];
    if (!text || src === target) return;

    const wrap = btn.parentElement?.querySelector(".ma365-translate-target") as HTMLElement | null;
    const labelEl = btn.parentElement?.querySelector(".ma365-translate-label") as HTMLElement | null;

    // Toggle wenn schon übersetzt
    if (btn.getAttribute("data-state") === "shown") {
      if (labelEl) labelEl.textContent = labelEl.getAttribute("data-original") || text;
      btn.setAttribute("data-state", "idle");
      btn.textContent = `🌐 ${target.toUpperCase()}`;
      return;
    }

    btn.setAttribute("data-state", "loading");
    btn.textContent = "🌐 …";

    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source_lang: src, target_lang: target }),
      });
      const j = await r.json() as { translated?: string; error?: string };
      if (!r.ok || !j.translated) throw new Error(j.error ?? "translate_failed");

      if (labelEl) {
        if (!labelEl.getAttribute("data-original")) labelEl.setAttribute("data-original", labelEl.textContent || text);
        labelEl.textContent = j.translated;
      } else if (wrap) {
        wrap.textContent = j.translated;
        wrap.style.display = "block";
      }
      btn.setAttribute("data-state", "shown");
      btn.textContent = "🌐 Original";
    } catch {
      btn.setAttribute("data-state", "error");
      btn.textContent = "🌐 ⚠️";
    }
  };

  rootEl.addEventListener("click", onClick, { capture: true });
  return () => rootEl.removeEventListener("click", onClick, { capture: true });
}

/** Kompakte Hook-Version: liest Browser-Sprache (z.B. für Vergleiche). */
export function useBrowserLang(): string {
  const [lang, setLang] = useState("de");
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setLang((navigator.language || "de").toLowerCase().split("-")[0]);
    }
  }, []);
  return lang;
}

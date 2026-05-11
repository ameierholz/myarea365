import Link from "next/link";
import type { Block } from "./_articles";

/**
 * Render-Layer für Blog-Blocks → JSX.
 * Keine externe Markdown-Dependency, voller Kontrolle über Layout/Styles.
 */
export function RenderBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="text-text leading-relaxed mb-4 text-[15px]">{block.text}</p>
      );
    case "h2":
      return (
        <h2 className="text-2xl font-black text-white mt-10 mb-4 leading-tight">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="text-lg font-bold text-white mt-6 mb-3 leading-snug">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="space-y-2 mb-5 list-none">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-text leading-relaxed text-[15px]">
              <span className="text-primary font-bold shrink-0 mt-0.5">›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="space-y-2 mb-5 list-none counter-reset-list">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-text leading-relaxed text-[15px]">
              <span className="inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-black">
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <aside
          className={`my-6 rounded-xl border p-4 ${
            block.tone === "warn"
              ? "border-[#FF6B4A]/40 bg-[#FF6B4A]/8"
              : block.tone === "tip"
                ? "border-[#FFD700]/40 bg-[#FFD700]/8"
                : "border-primary/40 bg-primary/8"
          }`}
        >
          <div className="flex gap-3">
            <span className="text-xl shrink-0" aria-hidden="true">
              {block.tone === "warn" ? "⚠️" : block.tone === "tip" ? "💡" : "ℹ️"}
            </span>
            <p className="text-text text-[14px] leading-relaxed">{block.text}</p>
          </div>
        </aside>
      );
    case "table":
      return (
        <div className="overflow-x-auto my-6 rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-border">
                {block.columns.map((c, i) => (
                  <th key={i} className="px-3 py-2.5 text-left font-bold text-white">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2.5 text-text-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cta":
      return (
        <div className="my-8 text-center">
          <Link
            href={block.href}
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-bg-deep font-black text-sm hover:opacity-90 transition"
          >
            {block.label} →
          </Link>
        </div>
      );
    default:
      return null;
  }
}

"use client";

export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        try { window.dispatchEvent(new CustomEvent("ma365:open-consent")); } catch { /* noop */ }
      }}
      className={className}
    >
      {label}
    </button>
  );
}
